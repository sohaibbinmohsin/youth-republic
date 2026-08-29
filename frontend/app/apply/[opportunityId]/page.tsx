"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplyForm } from "@/components/ApplyForm";

export default function ApplyPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = use(params);
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) setAccessToken(sessionData.session.access_token);

      const { data: opportunity } = await supabase
        .from("opportunities")
        .select("organization_id")
        .eq("id", opportunityId)
        .single();
      if (opportunity) setOrganizationId(opportunity.organization_id);
    }
    load();
  }, [opportunityId]);

  if (!accessToken || !organizationId) {
    return <p>Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Apply</h1>
      <ApplyForm
        opportunityId={opportunityId}
        organizationId={organizationId}
        accessToken={accessToken}
        onSuccess={() => router.push("/applications")}
      />
    </div>
  );
}
