"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplicationStatusBadge, type ApplicationStatus } from "@/components/ApplicationStatusBadge";

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  opportunities: { name: string } | null;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRow[] | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data } = await supabase
        .from("applications")
        .select("id, status, applied_at, opportunities(name)")
        .order("applied_at", { ascending: false });
      setApplications((data as unknown as ApplicationRow[]) ?? []);
    }
    load();
  }, []);

  if (!applications) return <p>Loading…</p>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">My Applications</h1>
      <ul className="space-y-3">
        {applications.map((application) => (
          <li key={application.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
            <span>{application.opportunities?.name}</span>
            <ApplicationStatusBadge status={application.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
