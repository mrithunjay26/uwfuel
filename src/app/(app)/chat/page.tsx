"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, History, KeyRound, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChatBubble } from "@/components/app/ChatBubble";
import { AuroraHeader } from "@/components/app/AuroraHeader";
import { useAuth } from "@/lib/auth/AuthContext";
import { useConfig } from "@/lib/config/ConfigContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useUserDb } from "@/lib/hooks/useUserDb";
import { useFoodLog } from "@/lib/hooks/useFoodLog";
import { useChatSessions } from "@/lib/hooks/useChatSessions";
import { callCohere } from "@/lib/ai/cohere";
import { createChatSession, appendChatMessage, deleteChatSession } from "@/lib/db/userDb";
import {
  getDiningMenu,
  getDiningLocations,
  resolveMenuDate,
  todayPacificKey,
  type DiningLocationsSnapshot,
  type DiningMenuSnapshot,
} from "@/lib/firebase/dining";
import { flattenFullMenu, buildLocationOpenMap, type FlatMenuItem } from "@/lib/menu/flattenMenu";
import { dailyTargetCalories } from "@/lib/utils/nutrition";
import type { ChatSession } from "@/lib/db/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const MEAL_PLAN_KEYWORDS = [
  "meal plan", "plan for", "plan me", "generate", "create plan",
  "make me a plan", "suggest meals", "what should i eat", "plan my day",
  "full day", "3 meals", "three meals", "4 meals", "four meals",
];

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { cohereKey, hasCohere } = useConfig();
  const handle = useUserDb();
  const { profile } = useUserProfile();
  const today = todayPacificKey();
  const { totals } = useFoodLog(today);
  const { sessions } = useChatSessions();

  const [locations, setLocations] = useState<DiningLocationsSnapshot | null>(null);
  const [menuItems, setMenuItems] = useState<FlatMenuItem[]>([]);
  const [menuDate, setMenuDate] = useState(today);
  const [contextLoaded, setContextLoaded] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
        const [locs, { dateKey }] = await Promise.all([getDiningLocations(), resolveMenuDate()]);
        if (cancelled) return;
        setLocations(locs);
        setMenuDate(dateKey);
        const menu = await getDiningMenu(dateKey) as DiningMenuSnapshot | null;
        if (cancelled) return;
        const locNames = Object.fromEntries(Object.entries(locs).map(([id, l]) => [id, l.name]));
        setMenuItems(flattenFullMenu(menu, locNames, buildLocationOpenMap(locs)).slice(0, 100));
      } catch {  }
      finally { if (!cancelled) setContextLoaded(true); }
    }
    loadContext();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, sending]);

  const buildPrompt = useCallback(
    (userText: string, history: Message[]) => {
      const userName = user?.displayName?.split(" ")[0] || "Student";
      const targetKcal = profile ? dailyTargetCalories(profile.current_weight, profile.target_weekly_change_lbs) : 2000;
      const isMealPlanReq = MEAL_PLAN_KEYWORDS.some((k) => userText.toLowerCase().includes(k));

      const compactMenu = menuItems.slice(0, 80).map((i) => ({
        name: i.name,
        location_name: i.location_name,
        category_name: i.category_name,
        available_now: i.available_now,
        calories: i.calories,
        protein_grams: i.protein_grams,
        price: i.price,
      }));

      const pacificTime = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date());

      const systemPrompt = `You are a helpful UW Fuel dining & nutrition assistant for ${userName}.
Current Pacific time: ${pacificTime}. Menu date: ${menuDate}.

USER PROFILE & GOAL:
${profile ? `- Current weight: ${profile.current_weight} lbs, Goal weight: ${profile.goal_weight} lbs (${
  profile.goal_weight > profile.current_weight ? "gaining" : profile.goal_weight < profile.current_weight ? "losing" : "maintaining"
})
- Phase: ${profile.phase}, target pace: ${profile.target_weekly_change_lbs ?? 0} lb/week, Daily calorie target: ${targetKcal} kcal
- Calories logged today: ${Math.round(totals.calories)} kcal, Cost spent: $${totals.cost.toFixed(2)}
When relevant, coach the student toward this goal — tie food, macro, and training suggestions back to their phase, target pace, and calorie target.` : "- Profile not set up yet; gently suggest setting a goal for tailored advice."}

${isMealPlanReq ? `The user is asking for a meal plan. Suggest meals using ONLY items from the menu data.
Format: **Meal Type** (time): [Item] at [Location] — [cal]cal, [protein]g protein, $[price]
End with: **Daily Total**: [total]cal, [protein]g, $[cost]` : ""}

Use **bold** for emphasis. Keep responses concise. When suggesting food always include cal, protein, and price.
Mention whether dining locations are currently open. Use exact numbers from menu data.

DINING LOCATIONS:
${locations ? Object.values(locations).slice(0, 20).map((l) => `${l.name}: ${l.current_status}`).join("\n") : "Loading…"}

MENU ITEMS (${compactMenu.length} items available):
${JSON.stringify(compactMenu, null, 1)}`;

      const cohereMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userText },
      ];

      return cohereMessages;
    },
    [user, profile, menuItems, menuDate, locations, totals],
  );

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !cohereKey || sending) return;
    const text = input.trim();
    setInput("");

    const userMsg: Message = { role: "user", content: text, timestamp: new Date().toISOString() };
    const priorHistory = messages;
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    let sid = activeId;
    if (handle) {
      try {
        if (!sid) {
          sid = await createChatSession(handle.db, handle.uid, text);
          setActiveId(sid);
        }
        await appendChatMessage(handle.db, handle.uid, sid, { role: "user", content: text });
      } catch {}
    }

    abortRef.current = new AbortController();
    try {
      const prompt = buildPrompt(text, priorHistory);
      const reply = await callCohere(cohereKey, prompt, {
        temperature: 0.55,
        signal: abortRef.current.signal,
      });

      const aiMsg: Message = { role: "assistant", content: reply, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);

      if (handle && sid) {
        appendChatMessage(handle.db, handle.uid, sid, { role: "assistant", content: reply }).catch(() => {});
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      const errMsg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${errMsg}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [input, cohereKey, sending, messages, activeId, handle, buildPrompt, abortRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setShowHistory(false);
  }, [abortRef]);

  const openSession = useCallback((s: ChatSession) => {
    abortRef.current?.abort();
    setActiveId(s.id);
    setMessages(s.messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.created_at })));
    setShowHistory(false);
  }, [abortRef]);

  const removeSession = useCallback(
    async (s: ChatSession, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!handle) return;
      await deleteChatSession(handle.db, handle.uid, s.id).catch(() => {});
      if (s.id === activeId) newChat();
    },
    [handle, activeId, newChat],
  );

  const suggestions = [
    "What's open for lunch right now?",
    "Suggest a high-protein meal under $10",
    "Plan my meals for today",
    "What should I eat if I'm bulking?",
  ];

  const activeTitle = useMemo(
    () => sessions.find((s) => s.id === activeId)?.title,
    [sessions, activeId],
  );

  const inputBarOffset = "calc(80px + env(safe-area-inset-bottom))";

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh" }}>
      <AuroraHeader
        title="UW Fuel AI"
        subtitle={
          activeTitle
            ? activeTitle
            : contextLoaded
              ? `${menuItems.length} menu items loaded · ${menuDate}`
              : "Loading dining context…"
        }
        icon={<Sparkles className="size-[18px]" />}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(true)}
              aria-label="Chat history"
              className="press glass-soft grid size-9 place-items-center rounded-full text-ink"
            >
              <History className="size-4" />
            </button>
            <button
              onClick={newChat}
              aria-label="New chat"
              className="press glass-soft grid size-9 place-items-center rounded-full text-ink"
            >
              <Plus className="size-4" />
            </button>
          </div>
        }
      />

      {!hasCohere && (
        <div className="glass-panel mx-5 mt-4 flex items-start gap-3 rounded-[16px] p-4">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-ink">No AI key connected</p>
            <p className="mt-0.5 text-[12px] text-ink-soft">
              Add your Cohere API key in Profile → Settings to unlock chat.
            </p>
          </div>
          <button
            onClick={() => router.push("/profile")}
            className="shrink-0 rounded-[10px] bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-contrast"
          >
            Add key
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="thin-scrollbar flex-1 overflow-y-auto px-4 py-4"
        style={{ paddingBottom: "calc(96px + 80px + env(safe-area-inset-bottom))" }}
      >
        {messages.length === 0 ? (
          <EmptyState
            suggestions={suggestions}
            onSuggestion={(s) => setInput(s)}
            hasKey={hasCohere}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              />
            ))}
            {sending && <ChatBubble role="assistant" content="" isStreaming timestamp="" />}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="glass-nav fixed inset-x-0 z-30 mx-auto max-w-[480px] px-4 pt-3"
        style={{ bottom: inputBarOffset, paddingBottom: "12px", left: 0, right: 0 }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasCohere ? "Ask about campus dining…" : "Add your Cohere key to chat"}
            disabled={!hasCohere || sending}
            rows={1}
            className="no-scrollbar flex-1 resize-none rounded-[16px] border border-line bg-surface-2 px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-accent disabled:opacity-50"
            style={{ maxHeight: "120px", overflowY: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !hasCohere || sending}
            aria-label="Send message"
            className="press grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast shadow-[var(--shadow-md)] disabled:opacity-40"
          >
            {sending ? <RefreshCw className="size-4 animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.5} />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-ink-faint">
          Uses your own Cohere key · saved to your history
        </p>
      </div>

      {showHistory && (
        <HistoryDrawer
          sessions={sessions}
          activeId={activeId}
          onClose={() => setShowHistory(false)}
          onOpen={openSession}
          onNew={newChat}
          onDelete={removeSession}
        />
      )}
    </div>
  );
}

function HistoryDrawer({
  sessions,
  activeId,
  onClose,
  onOpen,
  onNew,
  onDelete,
}: {
  sessions: ChatSession[];
  activeId: string | null;
  onClose: () => void;
  onOpen: (s: ChatSession) => void;
  onNew: () => void;
  onDelete: (s: ChatSession, e: React.MouseEvent) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Chat history"
        className="glass-strong animate-rise fixed inset-y-0 right-0 z-50 ml-auto flex w-[82%] max-w-[360px] flex-col rounded-l-[24px] px-4 pt-[max(env(safe-area-inset-top),18px)] pb-[max(env(safe-area-inset-bottom),18px)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-extrabold text-ink">History</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-surface-3 text-ink-soft">
            <X className="size-4" />
          </button>
        </div>

        <button
          onClick={onNew}
          className="press mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-accent py-2.5 text-[13px] font-bold text-accent-contrast"
        >
          <Plus className="size-4" /> New conversation
        </button>

        <div className="thin-scrollbar mt-3 flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-faint">No saved conversations yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((s) => {
                const last = s.messages[s.messages.length - 1];
                return (
                  <button
                    key={s.id}
                    onClick={() => onOpen(s)}
                    className={`press group flex items-start gap-2 rounded-[14px] border p-3 text-left transition ${
                      s.id === activeId ? "border-accent bg-accent-soft/60" : "border-line bg-surface-2"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{s.title}</p>
                      {last && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-soft">
                          {last.role === "assistant" ? "AI: " : "You: "}{last.content}
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] text-ink-faint">{relTime(s.updated_at)}</p>
                    </div>
                    <span
                      onClick={(e) => onDelete(s, e)}
                      className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:text-danger"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="size-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function EmptyState({
  suggestions,
  onSuggestion,
  hasKey,
}: {
  suggestions: string[];
  onSuggestion: (s: string) => void;
  hasKey: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="animate-float grid size-16 place-items-center rounded-full bg-accent-soft text-3xl">🤖</div>
      <p className="mt-4 text-[16px] font-bold text-ink">Hey! I&apos;m your UW dining assistant.</p>
      <p className="mt-1 text-center text-[13px] text-ink-soft">
        Ask me about today&apos;s menu, meal planning, or your nutrition goals.
      </p>
      {hasKey && (
        <div className="mt-6 flex w-full flex-col gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="glass-panel press rounded-[14px] px-4 py-3 text-left text-[13px] font-medium text-ink-soft transition hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function relTime(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
