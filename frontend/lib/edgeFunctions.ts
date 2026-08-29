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
  organizationId: string;
  motivationStatement?: string;
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
}
export interface SubmitHoursResponse {
  activityHoursId: string;
}
export function submitHours(payload: SubmitHoursPayload, accessToken: string) {
  return callFunction<SubmitHoursResponse>("submit-hours", payload, accessToken);
}

export interface RequestCnicUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
}
export function requestCnicUploadUrl(accessToken: string) {
  return callFunction<RequestCnicUploadUrlResponse>("upload-cnic-document", { action: "upload" }, accessToken);
}

export type SensitiveFieldName = "dob" | "cnic_number" | "phone" | "emergency_contact" | "guardian_name" | "guardian_contact";
export interface UpdateSensitiveFieldPayload {
  fieldName: SensitiveFieldName;
  newValue: string;
}
export interface UpdateSensitiveFieldResponse {
  volunteerId: string;
}
export function updateSensitiveField(payload: UpdateSensitiveFieldPayload, accessToken: string) {
  return callFunction<UpdateSensitiveFieldResponse>("update-sensitive-field", payload, accessToken);
}
