"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { ApplyForm } from "@/components/ApplyForm";
import { recordReturnUrl } from "@/lib/returnUrl";
import ApplyLoading from "./loading";

const SEED_ORGS: Record<string, string> = {
  "1": "10000000-0000-4000-8000-000000000001",
  "2": "10000000-0000-4000-8000-000000000002",
  "3": "10000000-0000-4000-8000-000000000003",
  "4": "10000000-0000-4000-8000-000000000004",
  "5": "10000000-0000-4000-8000-000000000001",
  "6": "10000000-0000-4000-8000-000000000002",
  "ffd9cb51-8b8d-4914-9906-4a9dc124c59e": "10000000-0000-4000-8000-000000000001",
  "89942817-bbab-4490-980c-a62e47364206": "10000000-0000-4000-8000-000000000002",
  "4c116831-b2b1-449e-9b18-d6db41450bc9": "10000000-0000-4000-8000-000000000003",
  "80c2c058-9857-45bb-86e9-de181d180842": "10000000-0000-4000-8000-000000000004",
  "9a381d92-05d2-4db7-a2f8-fc48ee91b2c7": "10000000-0000-4000-8000-000000000001",
  "74153d71-a267-4c96-8638-d703b67592ec": "10000000-0000-4000-8000-000000000002",
};

export default function ApplyPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = use(params);
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      recordReturnUrl(`/apply/${opportunityId}`);
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push(`/login?redirectTo=${encodeURIComponent(`/apply/${opportunityId}`)}`);
        return;
      }
      setAccessToken(sessionData.session.access_token);

      try {
        const { data: opportunity } = await supabase
          .from("opportunities")
          .select("organization_id")
          .eq("id", opportunityId)
          .single();
        if (opportunity?.organization_id) {
          setOrganizationId(opportunity.organization_id);
          return;
        }
      } catch {
        // Continue to fallback
      }

      if (SEED_ORGS[opportunityId]) {
        setOrganizationId(SEED_ORGS[opportunityId]);
      }
    }
    load();
  }, [opportunityId, router]);

  if (!accessToken || !organizationId) {
    return <ApplyLoading />;
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
