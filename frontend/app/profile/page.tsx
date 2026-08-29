"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { SensitiveFieldEditor } from "@/components/SensitiveFieldEditor";
import { CnicUploadField } from "@/components/CnicUploadField";

interface VolunteerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  volunteer_code: string;
  cnic_number: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [cnicUploadedKey, setCnicUploadedKey] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      setAccessToken(sessionData.session.access_token);

      const { data } = await supabase
        .from("volunteers")
        .select("id, full_name, email, phone, volunteer_code, cnic_number")
        .eq("auth_user_id", sessionData.session.user.id)
        .single();
      setProfile(data);
    }
    load();
  }, []);

  if (!profile || !accessToken) {
    return <p>Loading profile…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{profile.full_name}</h1>
        <p className="text-sm text-gray-600">Volunteer ID: {profile.volunteer_code}</p>
      </div>

      <SensitiveFieldEditor
        fieldName="phone"
        fieldLabel="Phone"
        currentValue={profile.phone}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, phone: newValue } : p))}
      />

      <CnicUploadField accessToken={accessToken} onUploaded={setCnicUploadedKey} />
      {cnicUploadedKey && <p className="text-sm text-green-700">Document uploaded.</p>}
    </div>
  );
}
