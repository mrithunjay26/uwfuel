import type { Metadata } from "next";
import Link from "next/link";
import { DocSection, Callout } from "@/components/docs/DocKit";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How UW Fuel handles your data.",
};

const UPDATED = "June 9, 2026";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-[30px] font-extrabold leading-tight text-ink md:text-[40px]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-[13px] text-ink-faint">Last updated {UPDATED}</p>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          UW Fuel is built privacy first: you bring your own AI key and can bring your own database. This policy
          explains what’s collected, where it’s stored, and who can see it.
        </p>
      </div>

      <Callout type="security" title="The short version">
        We don’t sell your data. Your Cohere key and database settings are stored in the database under your account
        (never in your browser’s localStorage). Your meal and workout data lives in your own Firebase project if you
        connect one, otherwise in the shared project, isolated to your account.
      </Callout>

      <DocSection title="1. Information we handle">
        <ul className="ml-4 flex list-disc flex-col gap-1.5">
          <li><b className="font-semibold text-ink">Account info:</b> the email/display name from Firebase Authentication when you sign up or sign in with Google.</li>
          <li><b className="font-semibold text-ink">Profile &amp; activity:</b> weight, goals, logged meals, workouts, plans, class schedule, and chat history you create.</li>
          <li><b className="font-semibold text-ink">Credentials:</b> your Cohere API key and (optional) personal Firebase configuration.</li>
          <li><b className="font-semibold text-ink">Location (only if you enable it):</b> used on your device to find nearby dining and walking directions.</li>
        </ul>
      </DocSection>

      <DocSection title="2. Where your data is stored">
        <p>
          If you connect your own Firebase Realtime Database, your profile and activity are stored
          <b className="font-semibold text-ink"> in your project</b>. Otherwise they’re stored in UW Fuel’s shared
          Firebase project under <span className="font-mono text-[13px]">users/&#123;your-id&#125;</span>, isolated to
          your account by security rules. Either way, your Cohere key and database settings are stored under your
          account node, <b className="font-semibold text-ink">not in localStorage</b>.
        </p>
      </DocSection>

      <DocSection title="3. How your Cohere key is used">
        <p>
          Your Cohere key is used only to send AI requests <b className="font-semibold text-ink">from your device</b>
          {" "}to Cohere when you use the chatbot, meal planner, or workout generator. The content of those prompts
          (e.g. your goals and the dining menu) is sent to Cohere to generate a response. See Cohere’s privacy policy
          for how they process requests.
        </p>
      </DocSection>

      <DocSection title="4. Location data">
        <p>
          Geolocation is requested only when you turn on a nearby feature, is used on your device to compute distances
          and directions, and is <b className="font-semibold text-ink">not stored</b> on our servers. You can deny or
          revoke location permission at any time in your browser.
        </p>
      </DocSection>

      <DocSection title="5. Dining data">
        <p>
          UW dining menus, hours, and pricing are public information scraped from University of Washington Housing
          &amp; Food Services and stored in the shared project for everyone to read. This data contains no personal
          information about you.
        </p>
      </DocSection>

      <DocSection title="6. Third party services">
        <ul className="ml-4 flex list-disc flex-col gap-1.5">
          <li><b className="font-semibold text-ink">Cohere</b>: processes AI prompts using your key.</li>
          <li><b className="font-semibold text-ink">Google Firebase</b>: authentication and database.</li>
          <li><b className="font-semibold text-ink">OpenStreetMap</b>: map tiles; <b className="font-semibold text-ink">Google Maps</b>: opened for walking directions.</li>
        </ul>
      </DocSection>

      <DocSection title="7. Your choices and data deletion">
        <p>
          You can remove your Cohere key or disconnect your personal database any time in <b className="font-semibold text-ink">Profile</b>.
          You can delete logged meals, workouts, and chat conversations in the app. To delete your account data
          entirely, remove it from your connected database, or contact us to remove your account node from the shared
          project.
        </p>
      </DocSection>

      <DocSection title="8. Security">
        <p>
          Credentials are stored in the database scoped to your authenticated account rather than in browser storage,
          reducing exposure to cross site scripting. No system is perfectly secure; keep your account credentials and
          any personal database URL private.
        </p>
      </DocSection>

      <DocSection title="9. Children’s privacy">
        <p>UW Fuel is intended for university students and is not directed to children under 13.</p>
      </DocSection>

      <DocSection title="10. Changes &amp; contact">
        <p>
          We may update this policy; material changes will be reflected by the “last updated” date. Questions? See the
          project repository linked in the app, or review our{" "}
          <Link href="/terms" className="font-semibold text-accent-ink underline">Terms of Service</Link>.
        </p>
      </DocSection>
    </div>
  );
}
