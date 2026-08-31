import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Youth Republic",
  description: "Terms and conditions governing volunteer participation and organizational accreditation on Youth Republic.",
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
          Last updated: February 2026. Standard terms for volunteers and accredited organisations on Youth Republic.
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-[#4A4B46]">
        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            1. Acceptance of Terms
          </h2>
          <p>
            By creating an account or participating in volunteering programmes facilitated through Youth Republic (a platform by The Mohsin Project), you agree to be bound by these Terms of Service and our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            2. Volunteer Accounts &amp; National Profile
          </h2>
          <p>
            Youth Republic provides volunteers with a single verified identity (Volunteer ID) recognized across all partner non-profit organisations. Volunteers agree to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Provide accurate, truthful identity and contact details during registration.</li>
            <li>Maintain only one active volunteer profile on the platform.</li>
            <li>Upload valid CNIC or B-Form documentation to obtain verified status.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            3. Minors &amp; Safeguarding
          </h2>
          <p>
            Volunteers under the age of 18 must provide guardian contact information and obtain explicit guardian consent prior to participating in any in-person or remote opportunity. Youth Republic and partner organisations uphold strict child safeguarding policies.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            4. Service Hours &amp; Verification
          </h2>
          <p>
            Volunteer hours recorded on Youth Republic represent genuine, accredited community service. Hours are only finalized on a volunteer’s public portfolio once reviewed and approved by verified organisation supervisors. Any fraudulent submission of hours will result in profile suspension.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            5. Partner Organisation Commitments
          </h2>
          <p>
            All non-profit organisations listed on Youth Republic are vetted for credibility, mission authenticity, and safe operating environments. Partner organisations agree to treat volunteer data with confidentiality and evaluate applications fairly.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            6. Support &amp; Disputes
          </h2>
          <p>
            If you experience any issues with an application, hours dispute, or partner organisation, please reach out to{" "}
            <a href="mailto:support@themohsinproject.org" className="text-[#941A80] font-medium underline">
              support@themohsinproject.org
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
