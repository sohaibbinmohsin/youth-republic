import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Youth Republic",
  description:
    "Terms and conditions governing volunteer participation, safeguarding, and organizational accreditation on Youth Republic.",
};

export default function TermsPage() {
  return (
    <div className="py-8 sm:py-12 max-w-3xl mx-auto font-['Jost']">
      <div className="mb-8 border-b border-[#E7E4DC] pb-6">
        <Link href="/" className="crumb mb-4">
          ← Back to home
        </Link>
        <h1 className="font-['Oswald'] text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#24262D]">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[#6B6B66]">
          Last updated: August 31, 2026. The Mohsin Project Global (SMC) Pvt. Ltd (Corporate UID: 0352616).
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-[#4A4B46]">
        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            1. Acceptance of Terms
          </h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you and{" "}
            <strong>The Mohsin Project Global (SMC) Pvt. Ltd</strong> (Corporate Unique Identification No. 0352616), governing
            your access to and use of the Youth Republic platform, websites, and affiliated services (the &ldquo;Platform&rdquo;).
            By registering an account or participating in opportunities facilitated through the Platform, you agree to be bound
            by these Terms and our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            2. Eligibility &amp; Minors Safeguarding (13+)
          </h2>
          <p>
            Youth Republic is open to individuals aged <strong>13 and older</strong>. We strictly enforce youth protection and
            safeguarding standards:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>
              <strong>Minors (Ages 13–17):</strong> Must obtain verified consent from a parent or legal guardian prior to
              account verification and participation in any volunteer opportunity.
            </li>
            <li>
              <strong>Adult Volunteers (18+):</strong> Must verify their authentic legal identity using a valid Computerized
              National Identity Card (CNIC) or Passport.
            </li>
            <li>
              <strong>Safeguarding Protocol:</strong> All partner organizations hosting activities involving minors must maintain
              direct adult supervision and adhere to strict safeguarding guidelines.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            3. Volunteer Accounts &amp; National Verified ID
          </h2>
          <p>
            Registered volunteers are issued a single, non-transferable digital identity (&ldquo;Volunteer ID&rdquo;) recognized
            across all accredited partner non-profit organizations. Volunteers agree to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Provide truthful, accurate demographic and contact information during registration.</li>
            <li>Maintain only one (1) active volunteer profile across the network.</li>
            <li>
              Upload authentic CNIC (for adults) or B-Form (for minors) documentation to obtain verified status.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-[#941A80]/20 bg-[#941A80]/5 p-5">
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#941A80] mb-2">
            4. Document Privacy &amp; Immediate Purge Architecture
          </h2>
          <p className="text-[#24262D] font-medium mb-1">
            Your government identity documents are permanently deleted immediately after verification.
          </p>
          <p>
            To protect users from any data leakage incident, raw CNIC and B-Form files are reviewed exclusively by authorized
            compliance officers of The Mohsin Project Global and <strong>immediately purged from our systems</strong> once verification
            is completed. We do not store raw document files long-term. Partner non-profits only ever see your verified badge, academic
            profile, and accredited service hours.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            5. Service Hours &amp; Accreditation
          </h2>
          <p>
            Hours logged on Youth Republic represent genuine, accredited community service. Service hours remain pending until
            formally reviewed and approved by verified partner supervisors. Any fraudulent submission or falsification of hours
            will result in immediate profile suspension and badge revocation.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            6. Partner Organization Commitments
          </h2>
          <p>
            All non-profit organizations listed on Youth Republic are vetted for credibility, legal standing, and safe operating
            environments. Partner organizations agree to treat applicant data with strict confidentiality, refrain from selling or
            scraping data, and evaluate applications fairly.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            7. Limitation of Liability
          </h2>
          <p>
            Youth Republic connects volunteers with third-party community organizations. The Company does not directly employ
            volunteers. Participation in on-site community service, fieldwork, and relief activities is undertaken voluntarily at
            the user&rsquo;s own risk.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            8. Governing Law &amp; Jurisdiction
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the Islamic Republic of Pakistan.
            Any legal dispute arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts in{" "}
            <strong>Karachi, Pakistan</strong>.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            9. Support &amp; Legal Notices
          </h2>
          <p>
            If you have questions regarding these Terms or need assistance with your volunteer record, contact:
          </p>
          <p className="mt-2">
            <strong>The Mohsin Project Global (SMC) Pvt. Ltd</strong> (UID: 0352616)
            <br />
            Email:{" "}
            <a href="mailto:legal@themohsinproject.org" className="text-[#941A80] font-medium underline">
              legal@themohsinproject.org
            </a>{" "}
            /{" "}
            <a href="mailto:support@themohsinproject.org" className="text-[#941A80] font-medium underline">
              support@themohsinproject.org
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
