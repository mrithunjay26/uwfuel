import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, KeyRound, Database, Smartphone, Sparkles, Check } from "lucide-react";
import {
  DocLayout, MobileToc, Part, WalkStep, ClickPath, WhatIs, SuccessCheck,
  Callout, CodeBlock, Kbd, TimeBadge,
} from "@/components/docs/DocKit";

export const metadata: Metadata = {
  title: "Setup Guide",
  description:
    "A friendly, step by step walkthrough to set up UW Fuel with no technical experience needed. Get your AI key and (optionally) your own database in about 10 minutes.",
};

const TOC = [
  { id: "overview", label: "What you’ll set up" },
  { id: "ai-key", label: "1 · Your AI key" },
  { id: "database", label: "2 · Your database" },
  { id: "install", label: "3 · Install the app" },
  { id: "trouble", label: "Troubleshooting" },
  { id: "glossary", label: "Glossary" },
  { id: "faq", label: "FAQ" },
];

const FIREBASE_CONFIG_EXAMPLE = `const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "my-uwfuel.firebaseapp.com",
  databaseURL: "https://my-uwfuel-default-rtdb.firebaseio.com",
  projectId: "my-uwfuel",
  appId: "1:1234567890:web:abc123"
};`;

const FIREBASE_RULES = `{
  "rules": {
    ".read": true,
    ".write": true
  }
}`;

export default function GuidePage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12px] font-bold text-accent-ink">
          <Sparkles className="size-3.5" /> Setup guide
        </span>
        <h1 className="mt-3 font-display text-[30px] font-extrabold leading-tight text-ink md:text-[42px]">
          Let’s get you set up
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft md:text-[17px]">
          This is a slow, friendly walkthrough with <b className="font-semibold text-ink">no coding or tech experience needed</b>.
          We’ll explain every term and tell you exactly what to click. By the end, all of UW Fuel’s features will work.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <TimeBadge time="~10 minutes" />
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-ink-soft"><Check className="size-3 text-carbs" /> Beginner friendly</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-ink-soft"><Check className="size-3 text-carbs" /> 100% free</span>
        </div>
      </div>

      <div className="glass-panel rounded-[18px] p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Before you start</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-ink-soft">
          <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-carbs" /> Your phone or laptop, that’s it.</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-carbs" /> About 10 minutes of calm. We’ll go one tiny step at a time.</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-carbs" /> A Google or email account to make a free Cohere account.</li>
        </ul>
      </div>

      <MobileToc toc={TOC} />

      <DocLayout toc={TOC}>
        <div className="flex flex-col gap-14">

          <Part n="✦" id="overview" title="What you’ll set up">
            <p className="text-[15px] leading-relaxed text-ink-soft">There are just two things, and only the first is required:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="glass-panel rounded-[16px] p-4">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><KeyRound className="size-5" /></span>
                <p className="mt-2.5 font-display text-[15px] font-bold text-ink">1. An AI key <span className="text-[11px] font-bold text-accent-ink">· required</span></p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">A free key from Cohere that powers the chatbot, meal planner, and workout generator.</p>
              </div>
              <div className="glass-panel rounded-[16px] p-4">
                <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-accent"><Database className="size-5" /></span>
                <p className="mt-2.5 font-display text-[15px] font-bold text-ink">2. Your own database <span className="text-[11px] font-bold text-ink-faint">· optional</span></p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">Only if you want to store your data in your own account. You can skip this entirely.</p>
              </div>
            </div>
            <Callout type="tip" title="In a hurry?">
              Just do Part 1 (the AI key). Everything works on the shared database by default, and your data stays private to your account.
            </Callout>
          </Part>

          <Part n={1} id="ai-key" title="Get your free AI key" time="~4 min">
            <WhatIs term="an API key">
              Think of it like a personal password that lets UW Fuel talk to the AI (Cohere) <i>on your behalf</i>. It’s free,
              it lives only on your device + your account, and you can delete it any time. Without it, the AI features stay locked.
            </WhatIs>

            <div className="mt-2 flex flex-col">
              <WalkStep n={1} title="Open the Cohere sign up page">
                <p>Cohere is the company that provides the AI. Tap the button below and it opens in a new tab so you don’t lose this guide.</p>
                <a href="https://dashboard.cohere.com/welcome/register" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-contrast">
                  Open Cohere <ExternalLink className="size-3.5" />
                </a>
              </WalkStep>

              <WalkStep n={2} title="Create a free account">
                <p>Click <Kbd>Continue with Google</Kbd> (easiest), or sign up with your email and a password. There’s nothing to pay and no credit card.</p>
              </WalkStep>

              <WalkStep n={3} title="Go to the “API Keys” page">
                <p>Once you’re signed in, look at the menu on the left side of the screen and click <Kbd>API Keys</Kbd>.</p>
                <p className="text-[13px] text-ink-faint">Tip: you can also just type <span className="font-mono">dashboard.cohere.com/api-keys</span> into the address bar.</p>
              </WalkStep>

              <WalkStep n={4} title="Copy your Trial Key">
                <p>You’ll see a key already made for you called <b className="font-semibold text-ink">Trial Key</b>, a long jumble of letters and numbers.
                Click the little copy icon <Kbd>⧉</Kbd> next to it to copy the whole thing.</p>
                <Callout type="warn" title="Copy the whole key">
                  Make sure you copy all of it, with no spaces before or after. A partly copied key won’t work.
                </Callout>
              </WalkStep>

              <WalkStep n={5} title="Paste it into UW Fuel" last>
                <p>Back in UW Fuel, go to:</p>
                <ClickPath steps={["Profile", "AI key", "Add"]} />
                <p>Paste the key in the box, tap <Kbd>Test key</Kbd> to make sure it works, then tap <Kbd>Save</Kbd>. Done!</p>
              </WalkStep>
            </div>

            <SuccessCheck>
              The chat and meal planner stop saying “no AI key,” and tapping <b className="font-semibold text-ink">Generate</b> produces a plan.
            </SuccessCheck>
          </Part>

          <Part n={2} id="database" title="Use your own database" time="~6 min" optional>
            <Callout type="info" title="Do I need this?">
              <b className="font-semibold text-ink">No.</b> By default your meals, workouts and goals are stored privately under your account in the
              shared project. Only do this part if you specifically want to <i>own</i> all your data in your own Google/Firebase account.
            </Callout>

            <WhatIs term="a database">
              A database is just a place on the internet where your app’s data is saved (your logged meals, workouts, weight, etc.).
              “Firebase” is Google’s free database service. Connecting your own means your data lives in <i>your</i> Google account.
            </WhatIs>

            <div className="mt-2 flex flex-col">
              <WalkStep n={1} title="Create a Firebase project">
                <p>Open the Firebase console and click <Kbd>Add project</Kbd>. Give it any name (e.g. <i>my-uwfuel</i>), and on the analytics step you can switch it off, it’s not needed.</p>
                <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-contrast">
                  Open Firebase console <ExternalLink className="size-3.5" />
                </a>
              </WalkStep>

              <WalkStep n={2} title="Turn on the Realtime Database">
                <p>In the left menu, open <Kbd>Build</Kbd> then click <Kbd>Realtime Database</Kbd>, then the big <Kbd>Create Database</Kbd> button. Pick a location near you, and choose <b className="font-semibold text-ink">“Start in test mode”</b> (we’ll lock it down next).</p>
                <Callout type="warn" title="Realtime Database, not Firestore">
                  Firebase has two databases. Make sure you pick <b>Realtime Database</b>, not “Firestore”. UW Fuel only works with the Realtime one.
                </Callout>
              </WalkStep>

              <WalkStep n={3} title="Get your project’s settings">
                <p>Click the gear ⚙️ next to “Project Overview” → <Kbd>Project settings</Kbd>. Scroll down to <i>Your apps</i> and click the web icon <Kbd>&lt;/&gt;</Kbd>. Give the app any nickname and register it.</p>
                <p>Firebase then shows a block of text called <b className="font-semibold text-ink">firebaseConfig</b>. It looks like this:</p>
                <CodeBlock label="What firebaseConfig looks like (example)" code={FIREBASE_CONFIG_EXAMPLE} />
                <p className="text-[13px] text-ink-faint">You’ll copy the five values from <i>your</i> version into UW Fuel in step 5.</p>
              </WalkStep>

              <WalkStep n={4} title="Set your security rules">
                <p>Go back to <Kbd>Realtime Database</Kbd> and open the <Kbd>Rules</Kbd> tab. Replace what’s there with the text below and click <Kbd>Publish</Kbd>.</p>
                <CodeBlock label="Realtime Database rules" code={FIREBASE_RULES} />
                <Callout type="warn" title="Keep your database URL private">
                  With these rules, anyone who knows your database’s web address could read or change it. Don’t post your <Kbd>databaseURL</Kbd> publicly.
                  If you want stronger security with zero setup, simply skip this part and use the shared database, which is locked to your account automatically.
                </Callout>
              </WalkStep>

              <WalkStep n={5} title="Connect it in UW Fuel" last>
                <p>In UW Fuel, go to:</p>
                <ClickPath steps={["Profile", "Data Storage", "Connect my own Firebase"]} />
                <p>Paste each value from your <i>firebaseConfig</i> into the matching box and tap connect.</p>
              </WalkStep>
            </div>

            <SuccessCheck>
              Your Data Storage card shows <b className="font-semibold text-ink">“Personal DB · Connected”</b> with your project name.
            </SuccessCheck>
          </Part>

          <Part n={3} id="install" title="Install it like a real app" time="~1 min">
            <p className="text-[15px] leading-relaxed text-ink-soft">UW Fuel runs great in your browser, but adding it to your home screen makes it open in full screen like a normal app.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="glass-panel rounded-[16px] p-4">
                <p className="flex items-center gap-2 font-display text-[14px] font-bold text-ink"><Smartphone className="size-4 text-accent" /> iPhone (Safari)</p>
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-[13px] leading-relaxed text-ink-soft">
                  <li>Tap the <b className="font-semibold text-ink">Share</b> button (the square with an arrow).</li>
                  <li>Scroll down and tap <b className="font-semibold text-ink">Add to Home Screen</b>.</li>
                  <li>Tap <b className="font-semibold text-ink">Add</b>. The icon appears on your home screen.</li>
                </ol>
              </div>
              <div className="glass-panel rounded-[16px] p-4">
                <p className="flex items-center gap-2 font-display text-[14px] font-bold text-ink"><Smartphone className="size-4 text-accent" /> Android (Chrome)</p>
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-[13px] leading-relaxed text-ink-soft">
                  <li>Tap the <b className="font-semibold text-ink">⋮</b> menu (top right).</li>
                  <li>Tap <b className="font-semibold text-ink">Install app</b> (or “Add to Home screen”).</li>
                  <li>Confirm, and the app icon lands on your home screen.</li>
                </ol>
              </div>
            </div>
            <Callout type="tip">UW Fuel will also show a small “Install” banner on your phone to make this one tap.</Callout>
          </Part>

          <Part n="?" id="trouble" title="Troubleshooting">
            <div className="flex flex-col gap-3">
              {[
                ["“That key was rejected by Cohere.”", "Copy the full key again (no spaces). Brand new trial keys can take a minute to activate, so wait and try again."],
                ["The AI says “rate limit hit.”", "Free trial keys allow a limited number of requests per minute. Wait a moment, or upgrade to a Production key in Cohere."],
                ["My database won’t connect.", "Confirm you created a Realtime Database (not Firestore), your databaseURL ends in .firebaseio.com, and you published the rules from Part 2."],
                ["I don’t see the Install option.", "On iPhone you must use Safari (not Chrome). On Android use Chrome. If it’s already installed, the option won’t appear."],
              ].map(([q, a]) => (
                <div key={q} className="glass-panel rounded-[16px] p-4">
                  <p className="text-[14px] font-bold text-ink">{q}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{a}</p>
                </div>
              ))}
            </div>
          </Part>

          <Part n="A" id="glossary" title="Plain English glossary">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["API key", "A personal password that lets the app use a service (like the AI) for you. Free, private to you, deletable."],
                ["Cohere", "The company whose AI powers UW Fuel’s chat, meal plans, and workouts."],
                ["Firebase", "Google’s free service for storing app data online. Optional here."],
                ["Realtime Database", "The specific Firebase product UW Fuel uses to save your data."],
                ["PWA / “install”", "Adding the website to your home screen so it behaves like a downloaded app."],
                ["Shared vs. personal DB", "Shared = stored for you in the app’s project (private to your account). Personal = stored in your own Firebase."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-[14px] border border-line bg-surface-2/50 p-3.5">
                  <p className="text-[13px] font-bold text-ink">{t}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{d}</p>
                </div>
              ))}
            </div>
          </Part>

          <Part n="Q" id="faq" title="Quick answers">
            <div className="flex flex-col gap-3">
              {[
                ["Is UW Fuel really free?", "Yes. The app is free and open source. Cohere’s trial AI key is free too."],
                ["Is my data safe?", "Your AI key and database settings are stored in the database scoped to your account, never in your browser. You can read the full Privacy Policy below."],
                ["Do I have to set up a database?", "No, that part is optional. Everything works on the shared project, isolated to your account."],
                ["Can I remove my key later?", "Anytime, in Profile → AI key → Remove. Same for disconnecting a personal database."],
              ].map(([q, a]) => (
                <div key={q} className="glass-panel rounded-[16px] p-4">
                  <p className="text-[14px] font-bold text-ink">{q}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{a}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2.5">
              <Link href="/dashboard" className="press inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[14px] font-bold text-accent-contrast">Go to the app</Link>
              <Link href="/privacy" className="press inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-5 py-2.5 text-[14px] font-bold text-ink">Privacy Policy</Link>
              <Link href="/terms" className="press inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-5 py-2.5 text-[14px] font-bold text-ink">Terms</Link>
            </div>
          </Part>

        </div>
      </DocLayout>
    </div>
  );
}
