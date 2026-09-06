import type { FormDefinition } from "./forms";

/**
 * Thrown when an edge function replies with HTTP 422. `fieldErrors` is the
 * per-field map from the JSON body (`{}` when the body carries none), so callers
 * can surface inline form errors instead of a single opaque message.
 */
export class ValidationError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>, message = "validation") {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

async function callFunction<TResponse>(
  name: string,
  body: unknown,
  accessToken?: string,
): Promise<TResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 422) {
      throw new ValidationError(
        (data.fieldErrors ?? {}) as Record<string, string>,
        data.error ?? "validation",
      );
    }
    throw new Error(data.error ?? "request_failed");
  }
  return data as TResponse;
}

export interface RegisterVolunteerPayload {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  city: string;
  province: string;
  country: string;
  institution: string;
  degreeProgram: string;
  idDocType?: "cnic" | "b_form" | "passport";
  idDocNumber?: string;
  idDocAttachmentId?: string;
  guardianName?: string;
  guardianContact?: string;
  guardianConsent?: boolean;
}
export interface RegisterVolunteerResponse {
  volunteerId: string;
  volunteerCode: string;
}
export function registerVolunteer(payload: RegisterVolunteerPayload, accessToken: string) {
  return callFunction<RegisterVolunteerResponse>("register-volunteer", payload, accessToken);
}

export interface ApplyToOpportunityPayload {
  opportunityId: string;
  organizationId?: string;
  motivationStatement?: string;
  answers?: Record<string, unknown>;
  attachmentIds?: string[];
}
export interface ApplyToOpportunityResponse {
  applicationId: string;
}
export function applyToOpportunity(payload: ApplyToOpportunityPayload, accessToken: string) {
  return callFunction<ApplyToOpportunityResponse>("apply-to-opportunity", payload, accessToken);
}

export interface SubmitHoursPayload {
  participationId: string;
  opportunityId: string;
  organizationId: string;
  activityDate: string;
  hoursSubmitted: number;
  role?: string;
  location?: string;
  note?: string;
  attachmentIds?: string[];
}
export interface SubmitHoursResponse {
  activityHoursId: string;
}
export function submitHours(payload: SubmitHoursPayload, accessToken: string) {
  return callFunction<SubmitHoursResponse>("submit-hours", payload, accessToken);
}

export type SensitiveFieldName = "dob" | "id_doc_number" | "phone" | "emergency_contact" | "guardian_name" | "guardian_contact";
export interface UpdateSensitiveFieldPayload {
  fieldName: SensitiveFieldName;
  newValue: unknown;
}
export interface UpdateSensitiveFieldResponse {
  volunteerId: string;
}
export function updateSensitiveField(payload: UpdateSensitiveFieldPayload, accessToken: string) {
  return callFunction<UpdateSensitiveFieldResponse>("update-sensitive-field", payload, accessToken);
}

export interface UpdateProfileFieldPayload {
  fieldName: "city" | "institution" | "graduation_year" | "availability" | "skills" | "interests";
  newValue: string | number | string[];
}
export interface UpdateProfileFieldResponse {
  volunteerId: string;
}
export function updateProfileField(payload: UpdateProfileFieldPayload, accessToken: string) {
  return callFunction<UpdateProfileFieldResponse>("update-profile-field", payload, accessToken);
}

// Mirrors `AttachmentDomain` in backend/supabase/functions/_shared/attachmentPolicy.ts.
export type AttachmentDomain = "identity_doc" | "application_file" | "session_photo";

export interface RequestAttachmentUploadPayload {
  domain: AttachmentDomain;
  ownerType: "volunteer" | "application" | "activity_hours";
  ownerId: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename?: string;
}
export interface RequestAttachmentUploadResponse {
  attachmentId: string;
  uploadUrl: string;
  storagePath: string;
}
export function requestAttachmentUpload(payload: RequestAttachmentUploadPayload, accessToken: string) {
  return callFunction<RequestAttachmentUploadResponse>("request-attachment-upload", payload, accessToken);
}

export interface FinalizeAttachmentPayload {
  attachmentId: string;
}
export interface FinalizeAttachmentResponse {
  ok: true;
}
export function finalizeAttachment(payload: FinalizeAttachmentPayload, accessToken: string) {
  return callFunction<FinalizeAttachmentResponse>("finalize-attachment", payload, accessToken);
}

export interface GetAttachmentPayload {
  attachmentId: string;
}
export interface GetAttachmentResponse {
  url: string;
}
export function getAttachment(payload: GetAttachmentPayload, accessToken: string) {
  return callFunction<GetAttachmentResponse>("get-attachment", payload, accessToken);
}

// Mirrors get-volunteer-portfolio/handler.ts.
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
export function getVolunteerPortfolio(accessToken: string) {
  // volunteerId is derived from the token server-side; the body is ignored.
  return callFunction<Portfolio>("get-volunteer-portfolio", {}, accessToken);
}

// Mirrors get-opportunity-detail/handler.ts. Public / anon endpoint.
export interface GetOpportunityDetailPayload {
  opportunityId: string;
}
export interface OpportunityDetail {
  id: string;
  name: string;
  description: string | null;
  about: string | null;
  duties: string[];
  eligibility: string[];
  whatToBring: string[];
  type: string;
  location: string | null;
  isOnline: boolean;
  applicationOpenAt: string | null;
  applicationDeadline: string | null;
  activityStartAt: string | null;
  activityEndAt: string | null;
  capacity: number | null;
  computedStatus: string;
  orgId: string;
  orgName: string;
  orgAbout: string | null;
  orgLogoUrl: string | null;
  applicationForm: FormDefinition;
}
export function getOpportunityDetail(payload: GetOpportunityDetailPayload) {
  return callFunction<OpportunityDetail>("get-opportunity-detail", payload);
}

// Mirrors the public variant of list-opportunities/handler.ts.
export interface ListOpportunitiesPayload {
  organizationId?: string;
  type?: string;
  status?: string;
  online?: boolean;
  city?: string;
  search?: string;
  sort?: "newest" | "closing_soon" | "az";
  limit?: number;
  offset?: number;
}
export interface OpportunityCard {
  id: string;
  name: string;
  orgName: string;
  orgLogoUrl: string | null;
  type: string;
  city: string | null;
  online: boolean;
  computedStatus: string;
  description: string | null;
}
export interface ListOpportunitiesResponse {
  opportunities: OpportunityCard[];
  total: number;
  facets: {
    cities: string[];
    orgs: { id: string; name: string }[];
  };
}
export function listOpportunities(payload: ListOpportunitiesPayload = {}) {
  return callFunction<ListOpportunitiesResponse>("list-opportunities", payload);
}
