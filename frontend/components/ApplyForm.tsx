"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  applyToOpportunity,
  finalizeAttachment,
  registerVolunteer,
  requestAttachmentUpload,
  updateSensitiveField,
  ValidationError,
  type SensitiveFieldName,
} from "@/lib/edgeFunctions";
import { type FieldDef, type FormDefinition, validateAnswers } from "@/lib/forms";
import type { OpportunityDetailRow } from "@/lib/opportunityData";
import { CustomSelect } from "@/components/CustomSelect";
import { DateOfBirthInput } from "@/components/DateOfBirthInput";
import { AutocompleteInput } from "@/components/AutocompleteInput";
import { CnicUploadField } from "@/components/CnicUploadField";
import { GuardianConsentFields, type GuardianConsentValue } from "@/components/GuardianConsentFields";
import { isMinor } from "@/lib/ageUtils";
import { formatPhoneNumber } from "@/lib/phoneUtils";
import { formatCnic, isValidCnic } from "@/lib/cnicUtils";
import { INSTITUTIONS, CITIES, PAKISTAN_PROVINCES, COUNTRIES } from "@/lib/formDatasets";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

export interface VolunteerInitialProfile {
  id?: string;
  authUserId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  city?: string;
  province?: string;
  country?: string;
  institution?: string;
  degreeProgram?: string;
  idDocType?: "cnic" | "b_form" | "passport" | string;
  idDocNumber?: string;
  idDocAttachmentId?: string;
  guardianName?: string;
  guardianContact?: string;
  guardianConsent?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status?: string;
  hasPendingDetails?: boolean;
}

export interface ProfileDraftState {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  country: string;
  province: string;
  city: string;
  institution: string;
  degreeProgram: string;
  idDocType: "cnic" | "b_form" | "passport";
  idDocNumber: string;
  idDocAttachmentId: string;
  guardianName: string;
  guardianContact: string;
  guardianConsent: boolean;
}

export interface ApplyFormHandle {
  saveDraft: () => Promise<boolean>;
  isDirty: boolean;
}

type AnswerValue = string | number | boolean | string[];

const EMPTY_FORM: FormDefinition = { version: 1, fields: [] };

function initialAnswer(field: FieldDef): AnswerValue {
  if (field.type === "checkbox") return false;
  if (field.type === "multiselect" || field.type === "file") return [];
  if (field.type === "number") return "";
  return "";
}

export const ApplyForm = forwardRef<
  ApplyFormHandle,
  {
    opportunityId: string;
    organizationId?: string;
    accessToken: string;
    onSuccess: () => void;
    initialVolunteerProfile?: VolunteerInitialProfile | null;
    opportunity?: OpportunityDetailRow | null;
    initialAnswers?: Record<string, AnswerValue> | null;
    initialProfileDraft?: Partial<ProfileDraftState> | null;
    onDirtyChange?: (dirty: boolean) => void;
    children?: React.ReactNode;
    summaryCard?: React.ReactNode;
  }
>(function ApplyForm(
  {
    opportunityId,
    accessToken,
    onSuccess,
    initialVolunteerProfile,
    opportunity,
    initialAnswers,
    initialProfileDraft,
    onDirtyChange,
    children,
    summaryCard,
  },
  ref,
) {
  const form: FormDefinition = useMemo(() => {
    const f = opportunity?.application_form;
    return f && Array.isArray(f.fields) ? f : EMPTY_FORM;
  }, [opportunity]);

  const profile = initialVolunteerProfile ?? {};
  const showPendingDetails = Boolean(profile.hasPendingDetails);

  const authUserId = profile.authUserId || profile.id || "";
  const storageKey = authUserId
    ? `yr_apply_draft_${opportunityId}_${authUserId}`
    : `yr_apply_draft_${opportunityId}`;

  // 1. Initialize form answers
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    const seed: Record<string, AnswerValue> = {};
    for (const field of form.fields) seed[field.id] = initialAnswer(field);

    if (initialAnswers && typeof initialAnswers === "object") {
      Object.assign(seed, initialAnswers);
    }
    return seed;
  });

  // 2. Initialize pending profile details draft
  const [profileDraft, setProfileDraft] = useState<ProfileDraftState>(() => {
    const defaults: ProfileDraftState = {
      fullName: profile.fullName || "",
      email: profile.email || "",
      phone: profile.phone || "",
      dob: profile.dob || "",
      gender: profile.gender || "",
      country: profile.country || "Pakistan",
      province: profile.province || "",
      city: profile.city || "",
      institution: profile.institution || "",
      degreeProgram: profile.degreeProgram || "",
      idDocType: (profile.idDocType as "cnic" | "b_form" | "passport") || "cnic",
      idDocNumber: profile.idDocNumber || "",
      idDocAttachmentId: profile.idDocAttachmentId || "",
      guardianName: profile.guardianName || "",
      guardianContact: profile.guardianContact || "",
      guardianConsent: Boolean(profile.guardianConsent),
    };

    if (initialProfileDraft && typeof initialProfileDraft === "object") {
      Object.assign(defaults, initialProfileDraft);
    }
    return defaults;
  });

  const [filesByField, setFilesByField] = useState<Record<string, File[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load from local storage on mount if newer than initial props
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.answers) {
          setAnswers((prev) => ({ ...prev, ...parsed.answers }));
        }
        if (parsed?.profileDraft) {
          setProfileDraft((prev) => ({ ...prev, ...parsed.profileDraft }));
        }
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Continuous auto-save to localStorage
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateDraftLocally = (
    nextAnswers: Record<string, AnswerValue>,
    nextProfile: ProfileDraftState,
  ) => {
    setIsDirty(true);
    onDirtyChange?.(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ answers: nextAnswers, profileDraft: nextProfile, updatedAt: Date.now() }),
        );
      } catch {
        // ignore
      }
    }, 400);
  };

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      updateDraftLocally(next, profileDraft);
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function toggleInArray(id: string, value: string) {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const updated = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const next = { ...prev, [id]: updated };
      updateDraftLocally(next, profileDraft);
      return next;
    });
  }

  function setProfileField<K extends keyof ProfileDraftState>(key: K, val: ProfileDraftState[K]) {
    setProfileDraft((prev) => {
      const next = { ...prev, [key]: val };
      updateDraftLocally(answers, next);
      return next;
    });
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const isMinorApplicant = Boolean(profileDraft.dob && isMinor(profileDraft.dob));

  async function uploadFilesForField(field: FieldDef): Promise<string[]> {
    const files = filesByField[field.id] ?? [];
    const ids: string[] = [];
    for (const file of files) {
      const meta = await requestAttachmentUpload(
        {
          domain: "application_file",
          ownerType: "application",
          ownerId: crypto.randomUUID(),
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          originalFilename: file.name,
        },
        accessToken,
      );
      await fetch(meta.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      await finalizeAttachment({ attachmentId: meta.attachmentId }, accessToken);
      ids.push(meta.attachmentId);
    }
    return ids;
  }

  // Explicit Cloud Save
  async function handleSaveDraft(): Promise<boolean> {
    setSavingDraft(true);
    setError(null);
    setSaveNotice(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id || authUserId;

      const draftPayload = {
        opportunity_id: opportunityId,
        organization_id: opportunity?.organization_id,
        auth_user_id: currentUserId,
        volunteer_id: profile.id || null,
        status: "draft",
        answers,
        draft_profile: profileDraft,
        applicant_name: profileDraft.fullName || profile.fullName || "",
        applicant_email: profileDraft.email || profile.email || userData.user?.email || "",
        applicant_phone: profileDraft.phone || profile.phone || "",
      };

      const { error: upsertErr } = await supabase
        .from("applications")
        .upsert(draftPayload, { onConflict: "auth_user_id,opportunity_id" });

      if (upsertErr) {
        // Fallback: update if exists or insert
        const { data: existing } = await supabase
          .from("applications")
          .select("id")
          .eq("opportunity_id", opportunityId)
          .eq("auth_user_id", currentUserId)
          .maybeSingle();

        if (existing) {
          await supabase.from("applications").update(draftPayload).eq("id", existing.id);
        } else {
          await supabase.from("applications").insert(draftPayload);
        }
      }

      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ answers, profileDraft, updatedAt: Date.now() }),
        );
      } catch {
        // ignore
      }

      setIsDirty(false);
      onDirtyChange?.(false);
      setSaveNotice("Draft saved to your portfolio! You can leave and resume anytime.");
      return true;
    } catch (err) {
      setSaveNotice("Draft saved in this browser. You can continue editing.");
      return false;
    } finally {
      setSavingDraft(false);
    }
  }

  useImperativeHandle(ref, () => ({
    saveDraft: handleSaveDraft,
    isDirty,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveNotice(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      const currentErrors: Record<string, string> = {};

      // 1. Validate pending profile details if requested
      if (showPendingDetails) {
        if (!profileDraft.fullName.trim()) currentErrors.fullName = "Full name is required";
        if (!profileDraft.phone.trim()) currentErrors.phone = "Phone number is required";
        if (!profileDraft.dob.trim()) currentErrors.dob = "Date of birth is required";
        if (!profileDraft.gender.trim()) currentErrors.gender = "Gender is required";
        if (!profileDraft.country.trim()) currentErrors.country = "Country is required";
        if (!profileDraft.province.trim()) currentErrors.province = "Province is required";
        if (!profileDraft.city.trim()) currentErrors.city = "City is required";
        if (!profileDraft.institution.trim()) currentErrors.institution = "Institution is required";
        if (!profileDraft.degreeProgram.trim()) currentErrors.degreeProgram = "Degree program is required";
        if (!profileDraft.idDocNumber.trim()) {
          currentErrors.idDocNumber = "ID document number is required";
        } else if (
          (profileDraft.idDocType === "cnic" || profileDraft.idDocType === "b_form") &&
          !isValidCnic(profileDraft.idDocNumber)
        ) {
          currentErrors.idDocNumber = "Must be a 13-digit number (XXXXX-XXXXXXX-X)";
        }

        if (isMinorApplicant) {
          if (!profileDraft.guardianName.trim()) currentErrors.guardianName = "Guardian name is required";
          if (!profileDraft.guardianContact.trim()) currentErrors.guardianContact = "Guardian contact is required";
          if (!profileDraft.guardianConsent) {
            currentErrors.guardianConsent = "Guardian consent is required for volunteers under 18";
          }
          if (profileDraft.idDocType !== "b_form") {
            currentErrors.idDocType = "Volunteers under 18 must provide a B-Form";
          }
        }
      }

      // 2. Upload any application form files
      const finalAnswers: Record<string, unknown> = { ...answers };
      const allAttachmentIds: string[] = [];
      for (const field of form.fields) {
        if (field.type !== "file") continue;
        const ids = await uploadFilesForField(field);
        finalAnswers[field.id] = ids;
        allAttachmentIds.push(...ids);
      }

      for (const field of form.fields) {
        if (field.type === "number" && finalAnswers[field.id] !== "" && finalAnswers[field.id] != null) {
          finalAnswers[field.id] = Number(finalAnswers[field.id]);
        }
      }

      // 3. Client-side validate dynamic questions (skip any legacy 'consent' field from DB — handled by fixed checkbox)
      const filteredForm = { ...form, fields: form.fields.filter((f) => f.id !== "consent") };
      const result = validateAnswers(filteredForm, finalAnswers);
      if (!result.ok) {
        Object.assign(currentErrors, result.fieldErrors);
      }

      // 4. Require the fixed consent checkbox
      if (!confirmed) {
        currentErrors.confirmed = "You must confirm before submitting.";
      }

      if (Object.keys(currentErrors).length > 0) {
        setFieldErrors(currentErrors);
        setError("Please fix the highlighted fields.");
        setSubmitting(false);
        return;
      }

      // 4. If user was missing profile details, register or update their volunteer profile
      if (showPendingDetails) {
        const supabase = getBrowserSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData.user?.id || authUserId;

        if (!profile.id) {
          await registerVolunteer(
            {
              fullName: profileDraft.fullName.trim(),
              email: profileDraft.email.trim(),
              phone: profileDraft.phone.trim(),
              dob: profileDraft.dob,
              gender: profileDraft.gender,
              city: profileDraft.city.trim(),
              province: profileDraft.province.trim(),
              country: profileDraft.country.trim(),
              institution: profileDraft.institution.trim(),
              degreeProgram: profileDraft.degreeProgram.trim(),
              idDocType: profileDraft.idDocType,
              idDocNumber: profileDraft.idDocNumber.trim(),
              idDocAttachmentId: profileDraft.idDocAttachmentId || undefined,
              guardianName: isMinorApplicant ? profileDraft.guardianName.trim() : undefined,
              guardianContact: isMinorApplicant ? profileDraft.guardianContact.trim() : undefined,
              guardianConsent: isMinorApplicant ? profileDraft.guardianConsent : undefined,
            },
            accessToken,
          );
        } else {
          // If already registered but was missing id_doc_number or other fields
          if (!profile.idDocNumber && profileDraft.idDocNumber) {
            await updateSensitiveField(
              { fieldName: "id_doc_number", newValue: profileDraft.idDocNumber.trim() },
              accessToken,
            );
          }
        }
      }

      // 5. Submit the application
      await applyToOpportunity(
        {
          opportunityId,
          answers: finalAnswers,
          attachmentIds: allAttachmentIds.length > 0 ? allAttachmentIds : undefined,
        },
        accessToken,
      );

      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }

      setIsDirty(false);
      onDirtyChange?.(false);
      onSuccess();
    } catch (err) {
      if (err instanceof ValidationError) {
        setFieldErrors(err.fieldErrors);
        setError("Please fix the highlighted fields.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="apply-form" id="applyForm" noValidate>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-[#FCEBEB] bg-[#FFF8F8] p-3.5 text-sm text-[#A32D2D]"
        >
          {error}
        </div>
      )}

      {saveNotice && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800"
        >
          {saveNotice}
        </div>
      )}

      {/* Profile Details Section */}
      {!showPendingDetails ? (
        /* Completed Profile - Compact Summary */
        <>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="a-name">Full name</label>
              <input id="a-name" value={profile.fullName ?? ""} readOnly />
            </div>
            <div className="field">
              <label htmlFor="a-phone">Phone</label>
              <input id="a-phone" value={profile.phone ?? ""} readOnly />
            </div>
          </div>
          <div className="field">
            <label htmlFor="a-email">Email</label>
            <input id="a-email" type="email" value={profile.email ?? ""} readOnly />
            <p className="hint">These come from your profile. Update them in Profile if they&rsquo;ve changed.</p>
          </div>
        </>
      ) : (
        /* Incomplete Profile - Collect Missing Details directly in application */
        <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--bg-2)] p-4 sm:p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <h3 className="text-base font-semibold text-[var(--ink)] m-0">Your Profile Details</h3>
              <span className="pill pill--pend text-[0.7rem] py-0.5 px-2">Pending Details</span>
            </div>
            <p className="text-xs text-[var(--ink-2)] m-0">
              Please complete your basic profile details so we can issue your verified volunteer credentials and attach them to your application.
            </p>
          </div>

          <div className="grid-2">
            <div className={`field ${fieldErrors.fullName ? "has-error" : ""}`}>
              <label htmlFor="a-name">Full name *</label>
              <input
                id="a-name"
                value={profileDraft.fullName}
                onChange={(e) => setProfileField("fullName", e.target.value)}
                placeholder="e.g. Ayesha Khan"
              />
              {fieldErrors.fullName && <p className="field__error">{fieldErrors.fullName}</p>}
            </div>

            <div className={`field ${fieldErrors.phone ? "has-error" : ""}`}>
              <label htmlFor="a-phone">Phone *</label>
              <input
                id="a-phone"
                type="tel"
                value={profileDraft.phone}
                onChange={(e) => setProfileField("phone", formatPhoneNumber(e.target.value))}
                placeholder="e.g. 0300 1234567"
              />
              {fieldErrors.phone && <p className="field__error">{fieldErrors.phone}</p>}
            </div>
          </div>

          <div className="field">
            <label htmlFor="a-email">Email</label>
            <input id="a-email" type="email" value={profileDraft.email} readOnly />
          </div>

          <div className="grid-2">
            <div className={`field ${fieldErrors.dob ? "has-error" : ""}`}>
              <label htmlFor="a-dob">Date of birth *</label>
              <DateOfBirthInput
                id="a-dob"
                value={profileDraft.dob}
                onChange={(val) => setProfileField("dob", val)}
              />
              {fieldErrors.dob && <p className="field__error">{fieldErrors.dob}</p>}
            </div>

            <div className={`field ${fieldErrors.gender ? "has-error" : ""}`}>
              <label htmlFor="a-gender">Gender *</label>
              <CustomSelect
                id="a-gender"
                name="gender"
                required={true}
                placeholder="Select gender…"
                value={profileDraft.gender}
                onChange={(val: string) => setProfileField("gender", val)}
                error={!!fieldErrors.gender}
                options={[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                  { value: "other", label: "Other" },
                  { value: "prefer_not_to_say", label: "Prefer not to say" },
                ]}
              />
              {fieldErrors.gender && <p className="field__error">{fieldErrors.gender}</p>}
            </div>
          </div>

          <div className="grid-2">
            <div className={`field ${fieldErrors.country ? "has-error" : ""}`}>
              <label htmlFor="a-country">Country *</label>
              <AutocompleteInput
                id="a-country"
                value={profileDraft.country}
                dataset={COUNTRIES}
                onChange={(val) => setProfileField("country", val)}
                placeholder="Select or type country…"
              />
              {fieldErrors.country && <p className="field__error">{fieldErrors.country}</p>}
            </div>

            <div className={`field ${fieldErrors.province ? "has-error" : ""}`}>
              <label htmlFor="a-province">Province / State *</label>
              {profileDraft.country.toLowerCase() === "pakistan" ? (
                <AutocompleteInput
                  id="a-province"
                  value={profileDraft.province}
                  dataset={PAKISTAN_PROVINCES}
                  onChange={(val) => setProfileField("province", val)}
                  placeholder="Select province…"
                />
              ) : (
                <input
                  id="a-province"
                  value={profileDraft.province}
                  onChange={(e) => setProfileField("province", e.target.value)}
                  placeholder="Province or State"
                />
              )}
              {fieldErrors.province && <p className="field__error">{fieldErrors.province}</p>}
            </div>
          </div>

          <div className="grid-2">
            <div className={`field ${fieldErrors.city ? "has-error" : ""}`}>
              <label htmlFor="a-city">City *</label>
              <AutocompleteInput
                id="a-city"
                value={profileDraft.city}
                dataset={CITIES}
                onChange={(val) => setProfileField("city", val)}
                placeholder="Select or type city…"
              />
              {fieldErrors.city && <p className="field__error">{fieldErrors.city}</p>}
            </div>

            <div className={`field ${fieldErrors.institution ? "has-error" : ""}`}>
              <label htmlFor="a-institution">Institution / University *</label>
              <AutocompleteInput
                id="a-institution"
                value={profileDraft.institution}
                dataset={INSTITUTIONS}
                onChange={(val) => setProfileField("institution", val)}
                placeholder="Select or type institution…"
              />
              {fieldErrors.institution && <p className="field__error">{fieldErrors.institution}</p>}
            </div>
          </div>

          <div className={`field ${fieldErrors.degreeProgram ? "has-error" : ""}`}>
            <label htmlFor="a-degree">Degree program *</label>
            <input
              id="a-degree"
              value={profileDraft.degreeProgram}
              onChange={(e) => setProfileField("degreeProgram", e.target.value)}
              placeholder="e.g. BS Computer Science, A-Levels, FSc"
            />
            {fieldErrors.degreeProgram && <p className="field__error">{fieldErrors.degreeProgram}</p>}
          </div>

          {/* ID Document Selection & Input */}
          <div className="grid-2 pt-2">
            <div className={`field ${fieldErrors.idDocType ? "has-error" : ""}`}>
              <label htmlFor="a-idDocType">Document type *</label>
              <CustomSelect
                id="a-idDocType"
                name="idDocType"
                required={true}
                ariaLabel="Document type"
                value={profileDraft.idDocType}
                onChange={(val: string) => {
                  const nextType = val as "cnic" | "b_form" | "passport";
                  setProfileField("idDocType", nextType);
                  if (nextType === "cnic" || nextType === "b_form") {
                    setProfileField("idDocNumber", formatCnic(profileDraft.idDocNumber));
                  }
                }}
                error={!!fieldErrors.idDocType}
                options={
                  isMinorApplicant
                    ? [{ value: "b_form", label: "B-Form (Under 18)" }]
                    : [
                        { value: "cnic", label: "CNIC (Adult)" },
                        { value: "b_form", label: "B-Form (Under 18)" },
                        { value: "passport", label: "Passport" },
                      ]
                }
              />
              {fieldErrors.idDocType && <p className="field__error">{fieldErrors.idDocType}</p>}
            </div>

            <div className={`field ${fieldErrors.idDocNumber ? "has-error" : ""}`}>
              <label htmlFor="a-id-num">
                {profileDraft.idDocType === "passport"
                  ? "Passport number *"
                  : profileDraft.idDocType === "b_form"
                  ? "B-Form number *"
                  : "CNIC number *"}
              </label>
              <input
                id="a-id-num"
                value={profileDraft.idDocNumber}
                onChange={(e) => {
                  const val =
                    profileDraft.idDocType === "passport"
                      ? e.target.value.toUpperCase().trim()
                      : formatCnic(e.target.value);
                  setProfileField("idDocNumber", val);
                }}
                placeholder={
                  profileDraft.idDocType === "passport" ? "e.g. AB1234567" : "35202-1234567-1"
                }
              />
              {fieldErrors.idDocNumber && <p className="field__error">{fieldErrors.idDocNumber}</p>}
            </div>
          </div>

          <CnicUploadField
            accessToken={accessToken}
            docType={profileDraft.idDocType}
            onUploaded={(attId) => setProfileField("idDocAttachmentId", attId)}
          />

          {/* Minor Guardian Consent Fields */}
          {isMinorApplicant && (
            <GuardianConsentFields
              guardianName={profileDraft.guardianName}
              guardianContact={profileDraft.guardianContact}
              guardianConsent={profileDraft.guardianConsent}
              onChange={(val: GuardianConsentValue) => {
                setProfileDraft((prev) => {
                  const next = {
                    ...prev,
                    guardianName: val.guardianName,
                    guardianContact: val.guardianContact,
                    guardianConsent: val.guardianConsent,
                  };
                  updateDraftLocally(answers, next);
                  return next;
                });
              }}
            />
          )}
        </div>
      )}

      {/* Dynamic Opportunity Form Questions — filter out legacy 'consent' checkbox (handled by fixed checkbox below) */}
      {form.fields.filter((f) => f.id !== "consent").length === 0 && (
        <p className="hint">This opportunity has no extra questions — just confirm below and submit.</p>
      )}

      {form.fields.filter((f) => f.id !== "consent").map((field) => (
        <ApplyField
          key={field.id}
          field={field}
          value={answers[field.id]}
          error={fieldErrors[field.id]}
          onChange={(v) => setAnswer(field.id, v)}
          onToggle={(v) => toggleInArray(field.id, v)}
          onFiles={(files) => setFilesByField((p) => ({ ...p, [field.id]: files }))}
          fileNames={(filesByField[field.id] ?? []).map((f) => f.name)}
        />
      ))}

      <div style={{ margin: "1rem 0" }}>
        <label className="checkline" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              if (fieldErrors.confirmed) {
                setFieldErrors((prev) => {
                  const n = { ...prev };
                  delete n.confirmed;
                  return n;
                });
              }
            }}
            style={{ marginTop: "2px" }}
          />
          <span>I confirm my details are accurate and I meet the eligibility criteria.</span>
        </label>
        {fieldErrors.confirmed && (
          <p className="field__error" style={{ marginTop: "0.25rem" }}>
            {fieldErrors.confirmed}
          </p>
        )}
      </div>

      {summaryCard && (
        <div className="apply-summary-mobile pane__aside" style={{ marginBottom: "1.25rem" }}>
          {summaryCard}
        </div>
      )}

      {children}

      {/* Form Actions: Submit & Save Draft */}
      <div className="flex flex-col sm:flex-row gap-3 pt-3 w-full">
        <button
          type="submit"
          disabled={submitting || savingDraft}
          className="btn btn--primary flex-[2] min-w-[200px] py-3 text-base justify-center font-medium"
          id="applySubmit"
        >
          {submitting ? "Submitting application…" : "Submit application"}
        </button>

        <button
          type="button"
          disabled={submitting || savingDraft}
          onClick={handleSaveDraft}
          className="btn btn--ghost flex-1 sm:min-w-[160px] py-3 text-base justify-center"
          id="applySaveDraft"
        >
          {savingDraft ? "Saving draft…" : "Save draft"}
        </button>
      </div>
    </form>
  );
});

function ApplyField({
  field,
  value,
  error,
  onChange,
  onToggle,
  onFiles,
  fileNames,
}: {
  field: FieldDef;
  value: AnswerValue;
  error?: string;
  onChange: (v: AnswerValue) => void;
  onToggle: (v: string) => void;
  onFiles: (files: File[]) => void;
  fileNames: string[];
}) {
  const labelNode = (
    <>
      {field.label}
      {field.required ? " *" : ""}
    </>
  );
  const help = field.help ? <p className="hint">{field.help}</p> : null;
  const err = error ? <p className="field__error">{error}</p> : null;
  const cls = `field${error ? " has-error" : ""}`;

  switch (field.type) {
    case "long_text":
      return (
        <div className={cls}>
          <label htmlFor={`f-${field.id}`}>{labelNode}</label>
          <textarea
            id={`f-${field.id}`}
            rows={3}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
          {err}
        </div>
      );
    case "select":
      return (
        <div className={cls}>
          <label htmlFor={`f-${field.id}`}>{labelNode}</label>
          <CustomSelect
            id={`f-${field.id}`}
            value={String(value ?? "")}
            options={field.options ?? []}
            onChange={(val) => onChange(val)}
            required={field.required}
            error={Boolean(error)}
            placeholder="Choose one…"
            ariaLabel={field.label}
          />
          {help}
          {err}
        </div>
      );
    case "radio":
      return (
        <fieldset className={error ? "has-error" : undefined}>
          <legend>{labelNode}</legend>
          <div className="checks">
            {(field.options ?? []).map((o) => (
              <label key={o.value}>
                <input
                  type="radio"
                  name={`f-${field.id}`}
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => onChange(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {help}
          {err}
        </fieldset>
      );
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <fieldset className={error ? "has-error" : undefined}>
          <legend>{labelNode}</legend>
          <div className="checks checks--inline">
            {(field.options ?? []).map((o) => (
              <label key={o.value}>
                <input type="checkbox" checked={arr.includes(o.value)} onChange={() => onToggle(o.value)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {help}
          {err}
        </fieldset>
      );
    }
    case "checkbox":
      return (
        <div>
          <label className="checkline" style={{ margin: ".25rem 0 1rem" }}>
            <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
            <span>{labelNode}</span>
          </label>
          {help}
          {err}
        </div>
      );
    case "file":
      return (
        <div className={cls}>
          <label htmlFor={`f-${field.id}`}>{labelNode}</label>
          <label className="upload">
            <input
              id={`f-${field.id}`}
              type="file"
              multiple={(field.maxFiles ?? 1) > 1}
              accept={(field.accept ?? []).join(",") || undefined}
              onChange={(e) => onFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
            <span className="upload__btn">Choose file{(field.maxFiles ?? 1) > 1 ? "s" : ""}</span>
            <span className="upload__name" data-empty="No file selected">
              {fileNames.length > 0 ? fileNames.join(", ") : "No file selected"}
            </span>
          </label>
          {help ?? (
            <p className="hint">
              {(field.accept ?? ["PDF or image"]).join(", ")}
              {field.maxSizeMB ? ` · up to ${field.maxSizeMB} MB` : ""}
              {(field.maxFiles ?? 1) > 1 ? ` · up to ${field.maxFiles} files` : ""}
            </p>
          )}
          {err}
        </div>
      );
    default: {
      const inputType =
        field.type === "email" ? "email" :
        field.type === "phone" ? "tel" :
        field.type === "url" ? "url" :
        field.type === "number" ? "number" :
        field.type === "date" ? "date" : "text";
      return (
        <div className={cls}>
          <label htmlFor={`f-${field.id}`}>{labelNode}</label>
          <input
            id={`f-${field.id}`}
            type={inputType}
            inputMode={field.type === "phone" ? "tel" : undefined}
            value={String(value ?? "")}
            placeholder={field.type === "url" ? "https://" : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
          {err}
        </div>
      );
    }
  }
}
