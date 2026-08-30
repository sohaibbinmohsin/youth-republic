import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerVolunteer,
  applyToOpportunity,
  submitHours,
  updateSensitiveField,
  updateProfileField,
  requestAttachmentUpload,
  finalizeAttachment,
  getAttachment,
  getVolunteerPortfolio,
  getOpportunityDetail,
  listOpportunities,
  ValidationError,
} from "./edgeFunctions";

const FUNCTIONS_URL = "http://localhost:54321/functions/v1";

beforeEach(() => {
  process.env.NEXT_PUBLIC_FUNCTIONS_URL = FUNCTIONS_URL;
  vi.stubGlobal("fetch", vi.fn());
});

function lastCall() {
  return (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
}

describe("registerVolunteer", () => {
  it("serialises the id-doc fields into the request body", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ volunteerId: "v1", volunteerCode: "VOL-2026-000001" }), { status: 201 }),
    );

    const result = await registerVolunteer(
      {
        fullName: "Test",
        email: "t@example.com",
        phone: "0300-1111111",
        dob: "1999-01-01",
        gender: "male",
        city: "Lahore",
        province: "Punjab",
        country: "Pakistan",
        institution: "Uni",
        degreeProgram: "BSCS",
        idDocType: "cnic",
        idDocNumber: "35201-1234567-1",
        idDocAttachmentId: "att-1",
      },
      "session-token",
    );

    expect(result.volunteerId).toBe("v1");
    const [url, init] = lastCall();
    expect(url).toBe(`${FUNCTIONS_URL}/register-volunteer`);
    expect(init.headers.Authorization).toBe("Bearer session-token");
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty("authUserId");
    expect(body.idDocType).toBe("cnic");
    expect(body.idDocNumber).toBe("35201-1234567-1");
    expect(body.idDocAttachmentId).toBe("att-1");
  });

  it("throws with the server's error message on failure", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "minor_consent_required" }), { status: 422 }),
    );

    await expect(
      registerVolunteer(
        {
          fullName: "Test",
          email: "t@example.com",
          phone: "0300-1111111",
          dob: "2015-01-01",
          gender: "male",
          city: "Lahore",
          province: "Punjab",
          country: "Pakistan",
          institution: "Uni",
          degreeProgram: "BSCS",
          idDocType: "b_form",
          idDocNumber: "35201-1234567-1",
          idDocAttachmentId: "att-1",
        },
        "session-token",
      ),
    ).rejects.toThrow("minor_consent_required");
  });
});

describe("applyToOpportunity", () => {
  it("serialises opportunityId, answers and attachmentIds and parses applicationId", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ applicationId: "app1" }), { status: 201 }),
    );

    const result = await applyToOpportunity(
      { opportunityId: "opp1", answers: { why: "I care" }, attachmentIds: ["att-1", "att-2"] },
      "session-token",
    );

    expect(result.applicationId).toBe("app1");
    const [url, init] = lastCall();
    expect(url).toBe(`${FUNCTIONS_URL}/apply-to-opportunity`);
    const body = JSON.parse(init.body);
    expect(body).toEqual({ opportunityId: "opp1", answers: { why: "I care" }, attachmentIds: ["att-1", "att-2"] });
    expect(body).not.toHaveProperty("organizationId");
    expect(body).not.toHaveProperty("motivationStatement");
  });

  it("throws a ValidationError carrying fieldErrors on a 422 response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "validation", fieldErrors: { why: "required" } }), { status: 422 }),
    );

    const err = await applyToOpportunity({ opportunityId: "opp1", answers: {} }, "session-token").catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fieldErrors).toEqual({ why: "required" });
  });
});

describe("submitHours", () => {
  it("serialises the note and attachmentIds fields", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ activityHoursId: "ah1" }), { status: 201 }),
    );

    const result = await submitHours(
      {
        participationId: "p1",
        opportunityId: "opp1",
        organizationId: "org1",
        activityDate: "2026-08-01",
        hoursSubmitted: 3,
        note: "Cleaned the park",
        attachmentIds: ["photo-1"],
      },
      "session-token",
    );

    expect(result.activityHoursId).toBe("ah1");
    const [, init] = lastCall();
    const body = JSON.parse(init.body);
    expect(body.note).toBe("Cleaned the park");
    expect(body.attachmentIds).toEqual(["photo-1"]);
  });
});

describe("updateSensitiveField", () => {
  it("accepts the id_doc_number field name", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ volunteerId: "v1" }), { status: 200 }),
    );

    const result = await updateSensitiveField(
      { fieldName: "id_doc_number", newValue: "35201-7654321-9" },
      "session-token",
    );

    expect(result.volunteerId).toBe("v1");
    const [, init] = lastCall();
    expect(JSON.parse(init.body).fieldName).toBe("id_doc_number");
  });
});

describe("updateProfileField", () => {
  it("posts to update-profile-field", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ volunteerId: "vol-1" }), { status: 200 }),
    );
    const result = await updateProfileField({ fieldName: "institution", newValue: "IBA" }, "session-token");
    expect(result.volunteerId).toBe("vol-1");
  });
});

describe("requestAttachmentUpload", () => {
  it("serialises the upload-request payload and parses the signed-url result", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ attachmentId: "att-1", uploadUrl: "https://storage/put/x", storagePath: "volunteer/v1/att-1.png" }),
        { status: 201 },
      ),
    );

    const result = await requestAttachmentUpload(
      {
        domain: "identity_doc",
        ownerType: "volunteer",
        ownerId: "v1",
        mimeType: "image/png",
        sizeBytes: 12345,
        originalFilename: "cnic.png",
      },
      "session-token",
    );

    expect(result).toEqual({
      attachmentId: "att-1",
      uploadUrl: "https://storage/put/x",
      storagePath: "volunteer/v1/att-1.png",
    });
    const [url, init] = lastCall();
    expect(url).toBe(`${FUNCTIONS_URL}/request-attachment-upload`);
    expect(JSON.parse(init.body)).toEqual({
      domain: "identity_doc",
      ownerType: "volunteer",
      ownerId: "v1",
      mimeType: "image/png",
      sizeBytes: 12345,
      originalFilename: "cnic.png",
    });
  });
});

describe("finalizeAttachment", () => {
  it("posts the attachmentId and parses { ok: true }", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await finalizeAttachment({ attachmentId: "att-1" }, "session-token");

    expect(result.ok).toBe(true);
    const [url, init] = lastCall();
    expect(url).toBe(`${FUNCTIONS_URL}/finalize-attachment`);
    expect(JSON.parse(init.body)).toEqual({ attachmentId: "att-1" });
  });
});

describe("getAttachment", () => {
  it("posts the attachmentId and parses the signed download url", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ url: "https://storage/get/x" }), { status: 200 }),
    );

    const result = await getAttachment({ attachmentId: "att-1" }, "session-token");

    expect(result.url).toBe("https://storage/get/x");
    const [url, init] = lastCall();
    expect(url).toBe(`${FUNCTIONS_URL}/get-attachment`);
    expect(JSON.parse(init.body)).toEqual({ attachmentId: "att-1" });
  });
});

describe("getVolunteerPortfolio", () => {
  it("sends an empty body with the token and parses the Portfolio shape", async () => {
    const portfolio = {
      volunteer: {
        fullName: "Aisha",
        volunteerCode: "VOL-2026-000001",
        city: "Lahore",
        institution: "IBA",
        chapterName: null,
        memberSince: "2026-01-01T00:00:00Z",
        status: "active",
      },
      totals: { verifiedHours: 12, activeApplications: 1, completedProgrammes: 2 },
      applications: [
        { id: "a1", opportunityName: "Beach Cleanup", orgName: "GreenOrg", type: "environment", location: "Karachi", status: "selected" },
      ],
      programmes: [
        {
          participationId: "p1",
          opportunityName: "Beach Cleanup",
          orgName: "GreenOrg",
          orgLogoUrl: null,
          type: "environment",
          status: "active",
          role: "Lead",
          startDate: null,
          endDate: null,
          hoursTotal: 6,
          hoursVerified: 6,
          allVerified: true,
          sessions: [
            { id: "s1", date: "2026-02-01", hours: 3, note: "Morning shift", status: "verified", adjusted: false, photoAttachmentIds: ["ph1"] },
          ],
        },
      ],
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(portfolio), { status: 200 }));

    const result = await getVolunteerPortfolio("session-token");

    expect(result).toEqual(portfolio);
    const [url, init] = lastCall();
    expect(url).toBe(`${FUNCTIONS_URL}/get-volunteer-portfolio`);
    expect(init.headers.Authorization).toBe("Bearer session-token");
    expect(JSON.parse(init.body)).toEqual({});
  });
});

describe("getOpportunityDetail", () => {
  it("posts opportunityId with no token and parses the OpportunityDetail shape", async () => {
    const detail = {
      id: "opp1",
      name: "Beach Cleanup",
      description: "Come help",
      about: "About the drive",
      duties: ["Pick litter"],
      eligibility: ["16+"],
      whatToBring: ["Gloves"],
      type: "environment",
      location: "Karachi",
      isOnline: false,
      applicationOpenAt: null,
      applicationDeadline: null,
      activityStartAt: null,
      activityEndAt: null,
      capacity: 20,
      computedStatus: "open",
      orgId: "org1",
      orgName: "GreenOrg",
      orgAbout: null,
      orgLogoUrl: null,
      applicationForm: { version: 1, fields: [] },
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }));

    const result = await getOpportunityDetail({ opportunityId: "opp1" });

    expect(result).toEqual(detail);
    const [url, init] = lastCall();
    expect(url).toBe(`${FUNCTIONS_URL}/get-opportunity-detail`);
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ opportunityId: "opp1" });
  });
});

describe("listOpportunities", () => {
  it("serialises the public filter payload and parses opportunities + total + facets", async () => {
    const response = {
      opportunities: [
        {
          id: "opp1",
          name: "Beach Cleanup",
          orgName: "GreenOrg",
          orgLogoUrl: null,
          type: "environment",
          city: "Karachi",
          online: false,
          computedStatus: "open",
          description: "Come help",
        },
      ],
      total: 1,
      facets: { cities: ["Karachi"], orgs: [{ id: "org1", name: "GreenOrg" }] },
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

    const result = await listOpportunities({ type: "environment", online: false, city: "Karachi", search: "beach", sort: "newest", limit: 10, offset: 0 });

    expect(result).toEqual(response);
    const [url, init] = lastCall();
    expect(url).toBe(`${FUNCTIONS_URL}/list-opportunities`);
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({
      type: "environment",
      online: false,
      city: "Karachi",
      search: "beach",
      sort: "newest",
      limit: 10,
      offset: 0,
    });
  });
});
