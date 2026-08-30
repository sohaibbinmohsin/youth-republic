import { SupabaseClient } from "@supabase/supabase-js";

export interface PortfolioApplication {
  id: string;
  opportunityName: string;
  orgName: string;
  orgLogoUrl: string | null;
  orgBrandColor: string | null;
  type: string;
  location: string | null;
  status: string;
}

export interface PortfolioSession {
  id: string;
  date: string;
  hours: number;
  note: string | null;
  status: string; // pending | verified | rejected
  adjusted: boolean;
  photoAttachmentIds: string[];
}

export interface PortfolioProgramme {
  participationId: string;
  opportunityName: string;
  orgName: string;
  orgLogoUrl: string | null;
  orgBrandColor: string | null;
  type: string;
  status: string;
  role: string | null;
  startDate: string | null;
  endDate: string | null;
  hoursTotal: number;
  hoursVerified: number;
  allVerified: boolean;
  sessions: PortfolioSession[];
}

export interface Portfolio {
  volunteer: {
    fullName: string;
    volunteerCode: string;
    city: string;
    institution: string;
    chapterName: string | null;
    memberSince: string;
    status: string; // pending_verification | active
  };
  totals: {
    verifiedHours: number;
    activeApplications: number;
    completedProgrammes: number;
  };
  applications: PortfolioApplication[];
  programmes: PortfolioProgramme[];
}

const ACTIVE_APPLICATION_STATUSES = ["submitted", "under_review", "waitlisted", "selected"];

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function embedded(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = row[key];
  return (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
}

export async function getVolunteerPortfolio(
  supabase: SupabaseClient,
  volunteerId: string,
): Promise<Portfolio> {
  // 1. Volunteer self + newest chapter link.
  const { data: volunteerRow, error: volunteerError } = await supabase
    .from("volunteers")
    .select("id, full_name, volunteer_code, city, institution, status, created_at")
    .eq("id", volunteerId)
    .single();
  if (volunteerError || !volunteerRow) throw new Error("not_found");
  const volunteer = volunteerRow as unknown as Record<string, unknown>;

  const { data: chapterLinks, error: chapterError } = await supabase
    .from("volunteer_chapter_link")
    .select("linked_at, chapters(name)")
    .eq("volunteer_id", volunteerId)
    .order("linked_at", { ascending: false })
    .limit(1);
  if (chapterError) throw chapterError;
  const chapterName =
    (embedded((chapterLinks ?? [])[0] as Record<string, unknown> ?? {}, "chapters").name as string | undefined) ??
      null;

  // 2. Applications + opportunity / org names.
  const { data: applicationRows, error: applicationsError } = await supabase
    .from("applications")
    .select("id, status, opportunities(name, type, location), organizations(name, logo_url, brand_color)")
    .eq("volunteer_id", volunteerId);
  if (applicationsError) throw applicationsError;

  const applications: PortfolioApplication[] = ((applicationRows ?? []) as unknown as Record<string, unknown>[])
    .map((r) => {
      const opp = embedded(r, "opportunities");
      const org = embedded(r, "organizations");
      return {
        id: r.id as string,
        opportunityName: (opp.name ?? "") as string,
        orgName: (org.name ?? "") as string,
        orgLogoUrl: (org.logo_url ?? null) as string | null,
        orgBrandColor: (org.brand_color ?? null) as string | null,
        type: (opp.type ?? "") as string,
        location: (opp.location ?? null) as string | null,
        status: r.status as string,
      };
    });

  // 3. Participation + opportunity / org.
  const { data: participationRows, error: participationError } = await supabase
    .from("participation")
    .select(
      "id, status, opportunities(name, type, activity_start_at, activity_end_at), organizations(name, logo_url, brand_color)",
    )
    .eq("volunteer_id", volunteerId);
  if (participationError) throw participationError;
  const participations = (participationRows ?? []) as unknown as Record<string, unknown>[];

  // 4. Activity hours (sessions), oldest first.
  const { data: hourRows, error: hoursError } = await supabase
    .from("activity_hours")
    .select("id, participation_id, activity_date, hours_submitted, hours_verified, verification_status, note, role")
    .eq("volunteer_id", volunteerId)
    .order("activity_date", { ascending: true });
  if (hoursError) throw hoursError;
  const hours = (hourRows ?? []) as unknown as Record<string, unknown>[];

  // 5. Session photos for those hours.
  const hourIds = hours.map((h) => h.id as string);
  let photoRows: Record<string, unknown>[] = [];
  if (hourIds.length > 0) {
    const { data, error } = await supabase
      .from("attachments")
      .select("id, owner_id")
      .eq("owner_type", "activity_hours")
      .in("owner_id", hourIds)
      .eq("domain", "session_photo")
      .eq("status", "ready");
    if (error) throw error;
    photoRows = (data ?? []) as unknown as Record<string, unknown>[];
  }
  const photosByHour = new Map<string, string[]>();
  for (const p of photoRows) {
    const ownerId = p.owner_id as string;
    const list = photosByHour.get(ownerId) ?? [];
    list.push(p.id as string);
    photosByHour.set(ownerId, list);
  }

  // Group sessions by participation.
  const hoursByParticipation = new Map<string, Record<string, unknown>[]>();
  for (const h of hours) {
    const pid = h.participation_id as string;
    const list = hoursByParticipation.get(pid) ?? [];
    list.push(h);
    hoursByParticipation.set(pid, list);
  }

  const programmes: PortfolioProgramme[] = participations.map((p) => {
    const opp = embedded(p, "opportunities");
    const org = embedded(p, "organizations");
    const sessionRows = hoursByParticipation.get(p.id as string) ?? [];

    const sessions: PortfolioSession[] = sessionRows.map((h) => {
      const submitted = num(h.hours_submitted);
      const verified = h.hours_verified;
      const adjusted = verified !== null && verified !== undefined && num(verified) !== submitted;
      return {
        id: h.id as string,
        date: h.activity_date as string,
        hours: verified !== null && verified !== undefined ? num(verified) : submitted,
        note: (h.note ?? null) as string | null,
        status: h.verification_status as string,
        adjusted,
        photoAttachmentIds: photosByHour.get(h.id as string) ?? [],
      };
    });

    const hoursTotal = sessionRows.reduce((sum, h) => sum + num(h.hours_submitted), 0);
    const hoursVerified = sessionRows.reduce(
      (sum, h) => (h.verification_status === "verified" ? sum + num(h.hours_verified) : sum),
      0,
    );
    const allVerified = sessions.length > 0 && sessions.every((s) => s.status === "verified");
    // participation has no role column; take the first session's role if any.
    const role = (sessionRows.find((h) => h.role != null)?.role ?? null) as string | null;

    return {
      participationId: p.id as string,
      opportunityName: (opp.name ?? "") as string,
      orgName: (org.name ?? "") as string,
      orgLogoUrl: (org.logo_url ?? null) as string | null,
      orgBrandColor: (org.brand_color ?? null) as string | null,
      type: (opp.type ?? "") as string,
      status: p.status as string,
      role,
      startDate: (opp.activity_start_at ?? null) as string | null,
      endDate: (opp.activity_end_at ?? null) as string | null,
      hoursTotal,
      hoursVerified,
      allVerified,
      sessions,
    };
  });

  // totals.verifiedHours: summed client-side over the fetched verified hours
  // (not the volunteer_total_verified_hours RPC), per the controller ruling.
  const verifiedHours = hours.reduce(
    (sum, h) => (h.verification_status === "verified" ? sum + num(h.hours_verified) : sum),
    0,
  );
  const activeApplications = applications.filter((a) => ACTIVE_APPLICATION_STATUSES.includes(a.status)).length;
  const completedProgrammes = participations.filter((p) => p.status === "completed").length;

  return {
    volunteer: {
      fullName: volunteer.full_name as string,
      volunteerCode: volunteer.volunteer_code as string,
      city: volunteer.city as string,
      institution: volunteer.institution as string,
      chapterName,
      memberSince: volunteer.created_at as string,
      status: volunteer.status as string,
    },
    totals: { verifiedHours, activeApplications, completedProgrammes },
    applications,
    programmes,
  };
}
