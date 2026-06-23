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
  ActiveWorkoutTemplate,
  ClassSchedule,
  FoodLogEntry,
  InventoryFood,
  MealPlan,
  UserProfile,
  WeightEntry,
  WorkoutLog,
  WorkoutLogExercise,
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
  return newRef.key;
}

export async function deleteLogEntry(
  db: Database,
  uid: string,
  dateKey: string,
  entryId: string,
): Promise<void> {
  await remove(ref(db, PATHS.logEntry(uid, dateKey, entryId)));
}

export async function updateLogEntry(
  db: Database,
  uid: string,
  dateKey: string,
  entryId: string,
  patch: Partial<Omit<FoodLogEntry, "logged_at">>,
): Promise<void> {
  await update(ref(db, PATHS.logEntry(uid, dateKey, entryId)), patch);
}

export async function clearDayLog(
  db: Database,
  uid: string,
  dateKey: string,
): Promise<void> {
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
  await set(ref(db, PATHS.activeWorkout(uid)), payload);
}

export async function clearActiveWorkoutTemplate(db: Database, uid: string): Promise<void> {
  await remove(ref(db, PATHS.activeWorkout(uid)));
}
