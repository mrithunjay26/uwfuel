import {
  get,
  push,
  ref,
  remove,
  set,
  update,
  type Database,
} from "firebase/database";
import { PATHS } from "@/lib/db/paths";
import type {
  ActivePlan,
  ActiveWorkoutPlan,
  ActiveWorkoutTemplate,
  ClassSchedule,
  FoodExpense,
  FoodLogEntry,
  InventoryFood,
  MealPlan,
  OnboardingProfile,
  ReadinessCheck,
  UserProfile,
  WeightEntry,
  WorkoutLog,
  WorkoutLogExercise,
  WorkoutPlan,
  WorkoutScheduleOverride,
} from "@/lib/db/types";

function nowIso(): string {
  return new Date().toISOString();
}

export async function saveProfile(
  db: Database,
  uid: string,
  profile: Omit<UserProfile, "updated_at">,
): Promise<void> {
  await update(ref(db, PATHS.profile(uid)), {
    ...profile,
    updated_at: nowIso(),
  });
}

export async function getProfile(
  db: Database,
  uid: string,
): Promise<UserProfile | null> {
  const snap = await get(ref(db, PATHS.profile(uid)));
  return snap.exists() ? (snap.val() as UserProfile) : null;
}

export async function saveWeight(
  db: Database,
  uid: string,
  dateKey: string,
  weight: number,
): Promise<void> {
  const entry: WeightEntry = {
    weight,
    timestamp: nowIso(),
    date: dateKey,
  };
  await set(ref(db, PATHS.weight(uid, dateKey)), entry);

  await update(ref(db, PATHS.profile(uid)), {
    current_weight: weight,
    updated_at: nowIso(),
  }).catch(() => {});
}

export async function logFoodItem(
  db: Database,
  uid: string,
  dateKey: string,
  entry: Omit<FoodLogEntry, "logged_at">,
): Promise<string> {
  const payload: FoodLogEntry = { ...entry, logged_at: nowIso() };
  const newRef = await push(ref(db, PATHS.dayLogs(uid, dateKey)), payload);
  if (!newRef.key) throw new Error("Firebase push returned no key.");
  if (payload.price > 0 && payload.funding_source && payload.funding_source !== "unknown") {
    const category = payload.funding_source === "dining_plan" ? "campus_meal" : "off_campus_meal";
    const expenseRef = await push(ref(db, PATHS.foodExpenses(uid)), {
      amount: payload.price,
      category,
      funding_source: payload.funding_source,
      occurred_at: payload.logged_at,
      date: dateKey,
      description: payload.name,
      linked_log_id: newRef.key,
    } satisfies FoodExpense);
    if (expenseRef.key) await update(newRef, { expense_id: expenseRef.key });
  }
  return newRef.key;
}

export async function deleteLogEntry(
  db: Database,
  uid: string,
  dateKey: string,
  entryId: string,
): Promise<void> {
  const snap = await get(ref(db, PATHS.logEntry(uid, dateKey, entryId)));
  const expenseId = snap.exists() ? (snap.val() as FoodLogEntry).expense_id : undefined;
  await remove(ref(db, PATHS.logEntry(uid, dateKey, entryId)));
  if (expenseId) await remove(ref(db, PATHS.foodExpense(uid, expenseId))).catch(() => {});
}

export async function saveOnboardingProfile(
  db: Database,
  uid: string,
  profile: Omit<OnboardingProfile, "updated_at">,
): Promise<void> {
  await set(ref(db, PATHS.onboardingProfile(uid)), { ...profile, updated_at: nowIso() } satisfies OnboardingProfile);
}

export async function saveFoodExpense(
  db: Database,
  uid: string,
  expense: Omit<FoodExpense, "occurred_at"> & { occurred_at?: string },
): Promise<string> {
  const newRef = await push(ref(db, PATHS.foodExpenses(uid)), { ...expense, occurred_at: expense.occurred_at ?? nowIso() });
  if (!newRef.key) throw new Error("Failed to create food expense.");
  return newRef.key;
}

export async function deleteFoodExpense(db: Database, uid: string, expenseId: string): Promise<void> {
  await remove(ref(db, PATHS.foodExpense(uid, expenseId)));
}

export async function saveReadinessCheck(
  db: Database,
  uid: string,
  dateKey: string,
  check: Omit<ReadinessCheck, "date" | "updated_at">,
): Promise<void> {
  await set(ref(db, PATHS.readiness(uid, dateKey)), { ...check, date: dateKey, updated_at: nowIso() } satisfies ReadinessCheck);
}

export async function saveWorkoutScheduleOverride(
  db: Database,
  uid: string,
  dateKey: string,
  override: Omit<WorkoutScheduleOverride, "date" | "updated_at">,
): Promise<void> {
  await set(ref(db, PATHS.workoutScheduleOverride(uid, dateKey)), { ...override, date: dateKey, updated_at: nowIso() } satisfies WorkoutScheduleOverride);
}

export async function updateLogEntry(
  db: Database,
  uid: string,
  dateKey: string,
  entryId: string,
  patch: Partial<Omit<FoodLogEntry, "logged_at">>,
): Promise<void> {
  const entryRef = ref(db, PATHS.logEntry(uid, dateKey, entryId));
  const snap = await get(entryRef);
  const current = snap.exists() ? snap.val() as FoodLogEntry : null;
  await update(entryRef, patch);
  if (!current) return;
  const next = { ...current, ...patch };
  if (current.expense_id) {
    await update(ref(db, PATHS.foodExpense(uid, current.expense_id)), {
      amount: next.price,
      funding_source: next.funding_source ?? "unknown",
      category: next.funding_source === "dining_plan" ? "campus_meal" : "off_campus_meal",
      description: next.name,
    });
  } else if (next.price > 0 && next.funding_source && next.funding_source !== "unknown") {
    const expenseId = await saveFoodExpense(db, uid, {
      amount: next.price,
      category: next.funding_source === "dining_plan" ? "campus_meal" : "off_campus_meal",
      funding_source: next.funding_source,
      date: dateKey,
      description: next.name,
      linked_log_id: entryId,
    });
    await update(entryRef, { expense_id: expenseId });
  }
}

export async function clearDayLog(
  db: Database,
  uid: string,
  dateKey: string,
): Promise<void> {
  const snap = await get(ref(db, PATHS.dayLogs(uid, dateKey)));
  if (snap.exists()) {
    const entries = Object.values(snap.val() as Record<string, FoodLogEntry>);
    await Promise.all(entries.map((entry) => entry.expense_id ? remove(ref(db, PATHS.foodExpense(uid, entry.expense_id))).catch(() => {}) : Promise.resolve()));
  }
  await remove(ref(db, PATHS.dayLogs(uid, dateKey)));
}

export async function saveInventoryFood(
  db: Database,
  uid: string,
  food: Omit<InventoryFood, "created_at">,
): Promise<string> {
  const payload: InventoryFood = { ...food, created_at: nowIso() };
  const newRef = await push(ref(db, PATHS.foodInventory(uid)), payload);
  if (!newRef.key) throw new Error("Firebase push returned no key.");
  return newRef.key;
}

export async function deleteInventoryFood(db: Database, uid: string, id: string): Promise<void> {
  await remove(ref(db, PATHS.inventoryItem(uid, id)));
}

export async function updateInventoryFood(
  db: Database,
  uid: string,
  id: string,
  patch: Partial<Omit<InventoryFood, "created_at">>,
): Promise<void> {
  await update(ref(db, PATHS.inventoryItem(uid, id)), patch);
}

export async function savePlanToRepo(
  db: Database,
  uid: string,
  dateKey: string,
  plan: Omit<MealPlan, "created_at" | "updated_at">,
  planId?: string,
): Promise<string> {
  const now = nowIso();
  const payload: MealPlan = {
    ...plan,
    created_at: now,
    updated_at: now,
  };

  if (planId) {
    await set(ref(db, PATHS.planEntry(uid, dateKey, planId)), payload);
    return planId;
  }

  const newRef = await push(ref(db, PATHS.dayPlanRepo(uid, dateKey)), payload);
  if (!newRef.key) throw new Error("Firebase push returned no key.");
  return newRef.key;
}

export async function deletePlanFromRepo(
  db: Database,
  uid: string,
  dateKey: string,
  planId: string,
): Promise<void> {
  await remove(ref(db, PATHS.planEntry(uid, dateKey, planId)));
}

export async function setActivePlan(
  db: Database,
  uid: string,
  activePlan: Omit<ActivePlan, "set_at">,
): Promise<void> {
  await set(ref(db, PATHS.activePlan(uid)), {
    ...activePlan,
    set_at: nowIso(),
  });
}

export async function clearActivePlan(db: Database, uid: string): Promise<void> {
  await remove(ref(db, PATHS.activePlan(uid)));
}

export async function getActivePlan(
  db: Database,
  uid: string,
): Promise<ActivePlan | null> {
  const snap = await get(ref(db, PATHS.activePlan(uid)));
  return snap.exists() ? (snap.val() as ActivePlan) : null;
}

export async function saveClassSchedule(
  db: Database,
  uid: string,
  schedule: ClassSchedule,
): Promise<void> {
  await set(ref(db, PATHS.classSchedule(uid)), schedule);
}

export async function getClassSchedule(
  db: Database,
  uid: string,
): Promise<ClassSchedule | null> {
  const snap = await get(ref(db, PATHS.classSchedule(uid)));
  return snap.exists() ? (snap.val() as ClassSchedule) : null;
}

function deriveChatTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 42 ? clean.slice(0, 42).trim() + "…" : clean;
}

export async function createChatSession(
  db: Database,
  uid: string,
  firstMessage: string,
): Promise<string> {
  const now = nowIso();
  const newRef = await push(ref(db, PATHS.chatSessions(uid)), {
    title: deriveChatTitle(firstMessage),
    created_at: now,
    updated_at: now,
  });
  if (!newRef.key) throw new Error("Firebase push returned no key.");
  return newRef.key;
}

export async function appendChatMessage(
  db: Database,
  uid: string,
  sessionId: string,
  message: { role: "user" | "assistant"; content: string },
): Promise<void> {
  const now = nowIso();
  await push(ref(db, PATHS.chatSessionMessages(uid, sessionId)), {
    role: message.role,
    content: message.content,
    created_at: now,
  });
  await update(ref(db, PATHS.chatSession(uid, sessionId)), { updated_at: now });
}

export async function deleteChatSession(
  db: Database,
  uid: string,
  sessionId: string,
): Promise<void> {
  await remove(ref(db, PATHS.chatSession(uid, sessionId)));
}

export async function logWorkout(
  db: Database,
  uid: string,
  workout: Omit<WorkoutLog, "created_at">,
): Promise<string> {
  const payload: WorkoutLog = { ...workout, created_at: nowIso() };
  const newRef = await push(ref(db, PATHS.workoutLogs(uid)), payload);
  if (!newRef.key) throw new Error("Firebase push returned no key.");
  return newRef.key;
}

export async function deleteWorkoutLog(
  db: Database,
  uid: string,
  logId: string,
): Promise<void> {
  await remove(ref(db, `${PATHS.workoutLogs(uid)}/${logId}`));
}

export async function updateWorkoutLog(
  db: Database,
  uid: string,
  logId: string,
  patch: Partial<Omit<WorkoutLog, "created_at">>,
): Promise<void> {
  await update(ref(db, `${PATHS.workoutLogs(uid)}/${logId}`), patch);
}

export async function setActiveWorkoutTemplate(
  db: Database,
  uid: string,
  template: { title: string; exercises: WorkoutLogExercise[] },
): Promise<void> {
  const payload: ActiveWorkoutTemplate = { ...template, created_at: nowIso() };
  await set(ref(db, PATHS.workoutTemplates(uid)), payload);
}

export async function clearActiveWorkoutTemplate(db: Database, uid: string): Promise<void> {
  await remove(ref(db, PATHS.workoutTemplates(uid)));
}

export async function saveWorkoutPlan(
  db: Database,
  uid: string,
  plan: Omit<WorkoutPlan, "created_at" | "updated_at">,
): Promise<string> {
  const now = nowIso();
  const newRef = await push(ref(db, PATHS.workoutRepo(uid)), {
    ...plan,
    created_at: now,
    updated_at: now,
  } satisfies WorkoutPlan);
  if (!newRef.key) throw new Error("Failed to create workout plan.");
  return newRef.key;
}

export async function updateWorkoutPlan(
  db: Database,
  uid: string,
  planId: string,
  patch: Partial<Omit<WorkoutPlan, "created_at">>,
): Promise<void> {
  await update(ref(db, PATHS.workoutPlan(uid, planId)), { ...patch, updated_at: nowIso() });
}

export async function deleteWorkoutPlan(db: Database, uid: string, planId: string): Promise<void> {
  await remove(ref(db, PATHS.workoutPlan(uid, planId)));
}

export async function setActiveWorkoutPlan(
  db: Database,
  uid: string,
  planId: string,
  plan: WorkoutPlan,
): Promise<void> {
  const payload: ActiveWorkoutPlan = { ...plan, plan_id: planId, set_at: nowIso() };
  await set(ref(db, PATHS.activeWorkout(uid)), payload);
}

export async function clearActiveWorkoutPlan(db: Database, uid: string): Promise<void> {
  await remove(ref(db, PATHS.activeWorkout(uid)));
}
