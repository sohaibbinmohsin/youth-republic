import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerVolunteer,
  applyToOpportunity,
  submitHours,
  requestCnicUploadUrl,
  updateSensitiveField,
} from "./edgeFunctions";

const FUNCTIONS_URL = "http://localhost:54321/functions/v1";

beforeEach(() => {
  process.env.NEXT_PUBLIC_FUNCTIONS_URL = FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

describe("registerVolunteer", () => {
  it("posts to register-volunteer with the access token and no authUserId in the body", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" }), { status: 201 }),
    );

    const result = await registerVolunteer(
      { fullName: "Test", email: "t@example.com", phone: "0300-1111111", dob: "1999-01-01", gender: "male", city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Uni", degreeProgram: "BSCS" },
      "session-token",
    );

    expect(result.volunteerId).toBe("v1");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/register-volunteer`);
    expect(init.headers.Authorization).toBe("Bearer session-token");
    expect(JSON.parse(init.body)).not.toHaveProperty("authUserId");
  });

  it("throws with the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "minor_consent_required" }), { status: 422 }),
    );

    await expect(
      registerVolunteer(
        { fullName: "Test", email: "t@example.com", phone: "0300-1111111", dob: "2015-01-01", gender: "male", city: "Lahore", province: "Punjab", country: "Pakistan", institution: "Uni", degreeProgram: "BSCS" },
        "session-token",
      ),
    ).rejects.toThrow("minor_consent_required");
  });
});

describe("applyToOpportunity", () => {
  it("posts to apply-to-opportunity without a volunteerId in the body", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ applicationId: "app1" }), { status: 201 }),
    );

    const result = await applyToOpportunity(
      { opportunityId: "opp1", organizationId: "org1" },
      "session-token",
    );

    expect(result.applicationId).toBe("app1");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).not.toHaveProperty("volunteerId");
  });
});

describe("submitHours", () => {
  it("posts to submit-hours", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ activityHoursId: "ah1" }), { status: 201 }),
    );

    const result = await submitHours(
      { participationId: "p1", opportunityId: "opp1", organizationId: "org1", activityDate: "2026-08-01", hoursSubmitted: 3 },
      "session-token",
    );

    expect(result.activityHoursId).toBe("ah1");
  });
});

describe("requestCnicUploadUrl", () => {
  it("posts action upload with no body fields beyond action", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ uploadUrl: "https://r2/put/x", objectKey: "cnic/v1/x" }), { status: 200 }),
    );

    const result = await requestCnicUploadUrl("session-token");

    expect(result.objectKey).toBe("cnic/v1/x");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${FUNCTIONS_URL}/upload-cnic-document`);
    expect(JSON.parse(init.body)).toEqual({ action: "upload" });
  });
});

describe("updateSensitiveField", () => {
  it("posts to update-sensitive-field", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ volunteerId: "v1" }), { status: 200 }),
    );

    const result = await updateSensitiveField(
      { fieldName: "phone", newValue: "0300-9998888" },
      "session-token",
    );

    expect(result.volunteerId).toBe("v1");
  });
});
