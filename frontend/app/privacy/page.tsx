import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Youth Republic",
  description:
    "How Youth Republic and The Mohsin Project Global handle volunteer information with a strict zero-retention immediate document purge policy.",
};

export default function PrivacyPage() {
  return (
    <div className="py-8 sm:py-12 max-w-3xl mx-auto font-['Jost']">
      <div className="mb-8 border-b border-[#E7E4DC] pb-6">
        <Link href="/" className="crumb mb-4">
          ← Back to home
        </Link>
        <h1 className="font-['Oswald'] text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#24262D]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[#6B6B66]">
          Last updated: August 31, 2026. The Mohsin Project Global (SMC) Pvt. Ltd (Corporate UID: 0352616).
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-[#4A4B46]">
        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            1. Overview &amp; Zero-Retention Commitment
          </h2>
          <p>
            Youth Republic, powered by <strong>The Mohsin Project Global (SMC) Pvt. Ltd</strong> (Corporate Unique Identification No. 0352616),
            is Pakistan&rsquo;s unified volunteer network and credentialing platform. We connect volunteers with accredited non-profit organisations,
            verify national volunteer identities, track community service hours, and issue tamper-evident credentials.
          </p>
          <p className="mt-2">
            To eliminate data leakage risks and provide uncompromising privacy defense, Youth Republic enforces an immediate document purge architecture
            for all sensitive government identification documents.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            2. Information We Collect
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>
              <strong>Account &amp; Demographics:</strong> Full legal name, email address, mobile number, date of birth, gender, city, province,
              and country.
            </li>
            <li>
              <strong>Academic &amp; Profile Details:</strong> Educational institution, degree program, graduation year, skills, interest areas,
              and bio.
            </li>
            <li>
              <strong>Transient Identity Verification Documents (Immediately Purged):</strong> CNIC/NICOP (for adults aged 18+) or B-Form document (for minors aged 13–17),
              uploaded solely for active verification and deleted permanently immediately thereafter.
            </li>
            <li>
              <strong>Guardian Consent &amp; Safeguarding:</strong> For volunteers under 18, guardian full name, relationship, contact
              information, and explicit digital consent records.
            </li>
            <li>
              <strong>Volunteering Activity:</strong> Applied opportunities, shift attendance records, verified service hours, supervisor sign-offs,
              and awarded digital credentials.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-[#941A80]/20 bg-[#941A80]/5 p-5">
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#941A80] mb-2">
            3. Zero Retention: Immediate Identity Document Purge
          </h2>
          <p className="text-[#24262D] font-medium mb-2">
            Your government identity documents are permanently deleted the moment verification is complete.
          </p>
          <p>
            To prevent any data leakage incident, raw CNIC, NICOP, and B-Form files are <strong>permanently wiped and deleted</strong> from our servers
            immediately after an authorized officer validates your identity. We do not store document copies long-term. Only an immutable cryptographic
            verification badge remains on your profile. Identity files are never shared with partner organisations, recruiters, or third parties.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            4. How We Use Your Information
          </h2>
          <p>We process your personal information strictly to:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Issue and maintain your unique, lifelong Volunteer ID.</li>
            <li>Facilitate direct applications to accredited volunteer opportunities across partner organisations.</li>
            <li>Verify authentic legal identity and ensure compliance with child safeguarding standards for minors.</li>
            <li>Accredit and generate tamper-evident records of your community service hours and digital certificates.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            5. Data Retention &amp; User Rights
          </h2>
          <p>
            You retain ownership of your personal data. You can request the review or deletion of your profile data at any time by contacting our
            Data Protection Officer. Verified institutional service records are retained in tamper-evident form to preserve the lifelong validity of
            your accredited certificates.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            6. Governing Law &amp; Jurisdiction
          </h2>
          <p>
            This Privacy Policy shall be governed by the laws of the Islamic Republic of Pakistan. Any legal dispute or claim regarding data
            protection shall be subject to the exclusive jurisdiction of the competent courts in <strong>Karachi, Pakistan</strong>.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            7. Contact &amp; Data Protection Officer
          </h2>
          <p>
            For privacy inquiries, data access requests, or guardian consent verification, contact:
          </p>
          <p className="mt-2">
            <strong>Data Protection Officer (DPO)</strong>
            <br />
            The Mohsin Project Global (SMC) Pvt. Ltd (Corporate UID: 0352616)
            <br />
            Email:{" "}
            <a href="mailto:support@themohsinproject.org" className="text-[#941A80] font-medium underline">
              support@themohsinproject.org
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
