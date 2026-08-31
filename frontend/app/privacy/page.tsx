import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Youth Republic",
  description: "How Youth Republic collects, protects, and handles volunteer information and identity documents.",
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
          Last updated: February 2026. How we protect your data, documents, and verified credentials across Youth Republic.
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-[#4A4B46]">
        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            1. Overview
          </h2>
          <p>
            Youth Republic, powered by The Mohsin Project, is Pakistan’s unified volunteer network. We connect volunteers with accredited non-profit organisations, track service hours, and issue verified digital credentials. This policy explains what personal data we collect, how it is secured, and your rights over your data.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            2. Information We Collect
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>
              <strong>Account and Profile Data:</strong> Full name, email address, phone number, date of birth, gender, educational institution, degree program, city, province, and country.
            </li>
            <li>
              <strong>Identity Verification Documents:</strong> CNIC (for adults) or B-Form document (for minors under 18) uploaded solely for administrative verification.
            </li>
            <li>
              <strong>Safeguarding &amp; Guardian Consent:</strong> For volunteers under 18, guardian full name, contact information, and explicit opt-in consent.
            </li>
            <li>
              <strong>Volunteering Activity:</strong> Applied opportunities, attendance logs, verified volunteer hours, supervisor sign-offs, and skills logged.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-[#941A80]/20 bg-[#941A80]/5 p-5">
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#941A80] mb-2">
            3. Identity Documents &amp; Partner Confidentiality
          </h2>
          <p className="text-[#24262D] font-medium mb-2">
            Your document is used only to verify your identity and is stored securely.
          </p>
          <p>
            Identity documents (CNIC / B-Form) are never shared with partner organisations or third parties. Partner organisations only ever see your verified badge and basic profile details (such as your name, institution, and approved hours), not the raw identity document itself.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            4. How We Use Your Information
          </h2>
          <p>We use your information strictly to:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Issue and maintain your unique, lifelong Volunteer ID.</li>
            <li>Enable seamless applications to volunteer opportunities across partner organisations.</li>
            <li>Verify your identity and maintain platform trust for participating non-profits.</li>
            <li>Accredit and generate tamper-evident records of your community service hours.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            5. Data Retention &amp; Deletion Rights
          </h2>
          <p>
            You retain ownership of your personal data. You can request the deletion of your account, profile, and stored identity documents at any time once you leave the platform by emailing{" "}
            <a href="mailto:support@themohsinproject.org" className="text-[#941A80] font-medium underline">
              support@themohsinproject.org
            </a>
            . Verified institutional hours records may be retained in anonymised form for compliance and certificate validation.
          </p>
        </section>

        <section>
          <h2 className="font-['Oswald'] text-lg font-bold uppercase tracking-wider text-[#24262D] mb-2">
            6. Contact &amp; Questions
          </h2>
          <p>
            If you have questions regarding this Privacy Policy or wish to review the information stored against your profile, contact our support team at{" "}
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
