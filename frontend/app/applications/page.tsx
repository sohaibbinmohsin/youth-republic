"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplicationStatusBadge, type ApplicationStatus } from "@/components/ApplicationStatusBadge";

const PAGE_SIZE = 20;

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  opportunities: { name: string } | null;
  participation: Array<{ status: string }> | null;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const offset = (page - 1) * PAGE_SIZE;
      const { data, count } = await supabase
        .from("applications")
        .select("id, status, applied_at, opportunities(name), participation(status)", { count: "exact" })
        .order("applied_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      setApplications((data as unknown as ApplicationRow[]) ?? []);
      setTotal(count ?? 0);
    }
    load();
  }, [page]);

  if (!applications) return <p>Loading…</p>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">My Applications</h1>
      <ul className="space-y-3">
        {applications.map((application) => (
          <li key={application.id} className="flex items-center justify-between rounded border border-gray-200 p-3">
            <span>{application.opportunities?.name}</span>
            <div className="flex items-center gap-2">
              {application.participation?.[0] && (
                <span className="text-sm text-gray-600">{application.participation[0].status}</span>
              )}
              <ApplicationStatusBadge status={application.status} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="underline disabled:no-underline disabled:text-gray-400">
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="underline disabled:no-underline disabled:text-gray-400">
          Next
        </button>
      </div>
    </div>
  );
}
