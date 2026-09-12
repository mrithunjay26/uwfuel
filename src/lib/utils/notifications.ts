import type { ReminderItem } from "@/lib/schedule/reminderPlan";

export function notificationsGranted(): boolean {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

async function activeWorker(): Promise<ServiceWorker | null> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    if (reg.active) return reg.active;
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    return ready?.active ?? navigator.serviceWorker.controller ?? null;
  } catch {
    return null;
  }
}

async function postToSW(message: unknown): Promise<boolean> {
  const target = await activeWorker();
  if (!target) return false;
  try {
    target.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

export async function syncReminders(reminders: ReminderItem[]): Promise<void> {
  if (!notificationsGranted()) {
    await postToSW({ type: "CANCEL_ALL_REMINDERS" });
    return;
  }
  await postToSW({ type: "SYNC_REMINDERS", payload: { reminders } });
}

export async function clearAllReminders(): Promise<void> {
  await postToSW({ type: "CANCEL_ALL_REMINDERS" });
}

export async function sendTestNotification(): Promise<void> {
  if (!notificationsGranted()) return;
  const ok = await postToSW({
    type: "TEST_NOTIFICATION",
    payload: {
      title: "Reminders on",
      body: "One nudge 30 minutes before each item in My Day.",
    },
  });
  if (!ok && typeof Notification !== "undefined") {
    try {
      new Notification("Reminders on", {
        body: "One nudge 30 minutes before each item in My Day.",
      });
    } catch {}
  }
}
