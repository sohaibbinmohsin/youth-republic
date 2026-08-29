"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { SensitiveFieldEditor } from "@/components/SensitiveFieldEditor";
import { ProfileFieldEditor } from "@/components/ProfileFieldEditor";
import { SkillsEditor } from "@/components/SkillsEditor";
import { EmergencyContactEditor } from "@/components/EmergencyContactEditor";
import { CnicUploadField } from "@/components/CnicUploadField";

interface VolunteerProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  volunteer_code: string;
  cnic_number: string | null;
  city: string;
  institution: string;
  graduation_year: number | null;
  availability: string | null;
  skills: string[] | null;
  interests: string[] | null;
  emergency_contact: { name: string; phone: string } | null;
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
        .select("id, full_name, email, phone, volunteer_code, cnic_number, city, institution, graduation_year, availability, skills, interests, emergency_contact")
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

      <ProfileFieldEditor
        fieldName="city"
        fieldLabel="City"
        currentValue={profile.city}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, city: newValue } : p))}
      />

      <ProfileFieldEditor
        fieldName="institution"
        fieldLabel="Institution"
        currentValue={profile.institution}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, institution: newValue } : p))}
      />

      <ProfileFieldEditor
        fieldName="graduation_year"
        fieldLabel="Expected graduation year"
        currentValue={profile.graduation_year?.toString() ?? ""}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, graduation_year: Number(newValue) } : p))}
      />

      <ProfileFieldEditor
        fieldName="availability"
        fieldLabel="Availability"
        currentValue={profile.availability ?? ""}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, availability: newValue } : p))}
      />

      <SkillsEditor
        fieldName="skills"
        fieldLabel="Skills"
        currentValue={profile.skills ?? []}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, skills: newValue } : p))}
      />

      <SkillsEditor
        fieldName="interests"
        fieldLabel="Areas of interest"
        currentValue={profile.interests ?? []}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, interests: newValue } : p))}
      />

      <EmergencyContactEditor
        currentValue={profile.emergency_contact}
        accessToken={accessToken}
        onUpdated={(newValue) => setProfile((p) => (p ? { ...p, emergency_contact: newValue } : p))}
      />

      <CnicUploadField accessToken={accessToken} onUploaded={setCnicUploadedKey} />
      {cnicUploadedKey && <p className="text-sm text-green-700">Document uploaded.</p>}
    </div>
  );
}
