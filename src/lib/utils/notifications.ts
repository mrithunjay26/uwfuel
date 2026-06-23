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

function timeStringToTodayDate(timeStr: string): Date | null {
  const [h, m] = (timeStr || "").split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export interface MealReminder {
  mealType: string;
  time: string;
  locationName: string;
  itemName: string;
}

async function postToSW(message: unknown): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const target = reg.active || navigator.serviceWorker.controller;
    if (!target) return false;
    target.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleMealReminders(meals: MealReminder[]): Promise<void> {
  if (!notificationsGranted()) return;

  await postToSW({ type: "CANCEL_MEAL_REMINDERS" });

  const now = Date.now();

  for (const meal of meals) {
    const mealDate = timeStringToTodayDate(meal.time);
    if (!mealDate) continue;

    const reminderMs = mealDate.getTime() - 30 * 60 * 1000;
    const delayMs = reminderMs - now;
    if (delayMs > 0) {
      await postToSW({
        type: "SCHEDULE_MEAL_REMINDER",
        payload: {
          title: `${meal.mealType} in 30 min`,
          body: `${meal.itemName} · ${meal.locationName}`,
          delayMs,
          tag: `meal-reminder-${meal.mealType.toLowerCase()}`,
          url: "/menu",
        },
      });
    }

    const exactDelayMs = mealDate.getTime() - now;
    if (exactDelayMs > 0) {
      await postToSW({
        type: "SCHEDULE_MEAL_REMINDER",
        payload: {
          title: `${meal.mealType} now`,
          body: `Head to ${meal.locationName} for ${meal.itemName}`,
          delayMs: exactDelayMs,
          tag: `meal-reminder-${meal.mealType.toLowerCase()}-now`,
          url: "/menu",
        },
      });
    }
  }
}

export async function cancelMealReminders(): Promise<void> {
  await postToSW({ type: "CANCEL_MEAL_REMINDERS" });
}

export async function sendTestNotification(): Promise<void> {
  if (!notificationsGranted()) return;
  const ok = await postToSW({
    type: "SCHEDULE_MEAL_REMINDER",
    payload: {
      title: "Meal reminders on ✓",
      body: "We'll nudge you before each planned meal today.",
      delayMs: 600,
      tag: "meal-reminder-test",
      url: "/plan",
    },
  });
  if (!ok && typeof Notification !== "undefined") {
    try { new Notification("Meal reminders on ✓", { body: "We'll nudge you before each planned meal today." }); } catch {}
  }
}
