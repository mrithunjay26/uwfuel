import type { Metadata } from "next";
import Link from "next/link";
import { DocSection } from "@/components/docs/DocKit";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of UW Fuel.",
};

const UPDATED = "June 9, 2026";

export default function TermsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-[30px] font-extrabold leading-tight text-ink md:text-[40px]">
          Terms of Service
        </h1>
        <p className="mt-2 text-[13px] text-ink-faint">Last updated {UPDATED}</p>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          UW Fuel is a free, student built nutrition and training companion for University of Washington students.
          By using it, you agree to these terms.
        </p>
      </div>

      <DocSection title="1. Acceptance of terms">
        <p>
          By accessing or using UW Fuel (the “Service”), you agree to be bound by these Terms of Service. If you do
          not agree, please do not use the Service.
        </p>
      </DocSection>

      <DocSection title="2. What UW Fuel is">
        <p>
          UW Fuel helps you browse UW dining menus, log meals and workouts, track progress, and generate AI meal and
          workout plans. AI features run on <b className="font-semibold text-ink">your own Cohere API key</b>, and your
          personal data is stored either in the shared project (isolated to your account) or in your own Firebase
          project if you choose to connect one.
        </p>
      </DocSection>

      <DocSection title="3. Accounts and eligibility">
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for all activity
          under your account. You must be old enough to form a binding contract in your jurisdiction. UW Fuel is
          intended for personal, noncommercial use.
        </p>
      </DocSection>

      <DocSection title="4. Your API keys and third party services">
        <p>
          You are responsible for obtaining and securing your own API keys (e.g. Cohere) and for any usage, costs, or
          rate limits associated with them. UW Fuel relies on third party services including Cohere (AI), Google
          Firebase (authentication and database), and OpenStreetMap (maps). Your use of those services is also
          governed by their respective terms.
        </p>
      </DocSection>

      <DocSection title="5. Acceptable use">
        <p>You agree not to misuse the Service, including by attempting to:</p>
        <ul className="ml-4 flex list-disc flex-col gap-1.5">
          <li>access another user’s data without authorization;</li>
          <li>reverse engineer, disrupt, or overload the Service or its providers;</li>
          <li>use the Service for unlawful purposes or to violate any third party’s rights.</li>
        </ul>
      </DocSection>

      <DocSection title="6. Not medical or dietary advice">
        <p>
          Calorie targets, macros, body composition estimates, and AI suggestions are informational only and may be
          inaccurate. UW Fuel is <b className="font-semibold text-ink">not</b> a substitute for professional medical,
          nutritional, or fitness advice. Consult a qualified professional before making health decisions.
        </p>
      </DocSection>

      <DocSection title="7. Dining data accuracy">
        <p>
          Menu, pricing, hours, and availability are scraped from public University of Washington Housing &amp; Food
          Services sources and may be outdated or incorrect. Always verify with the dining location. UW Fuel is an
          independent project and is <b className="font-semibold text-ink">not affiliated with, endorsed by, or
          sponsored by</b> the University of Washington or UW HFS.
        </p>
      </DocSection>

      <DocSection title="8. No warranty">
        <p>
          The Service is provided “as is” and “as available,” without warranties of any kind, express or implied,
          including merchantability, fitness for a particular purpose, and noninfringement. We do not warrant that
          the Service will be uninterrupted, secure, or free of errors.
        </p>
      </DocSection>

      <DocSection title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, UW Fuel and its contributors will not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or any loss of data, arising from your use of the
          Service.
        </p>
      </DocSection>

      <DocSection title="10. Changes to the Service and terms">
        <p>
          We may modify or discontinue the Service or update these terms at any time. Continued use after changes
          take effect constitutes acceptance of the revised terms.
        </p>
      </DocSection>

      <DocSection title="11. Contact">
        <p>
          Questions about these terms? See the project’s repository linked in the app, or review our{" "}
          <Link href="/privacy" className="font-semibold text-accent-ink underline">Privacy Policy</Link>.
        </p>
      </DocSection>
    </div>
  );
}
