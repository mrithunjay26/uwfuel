export type GoalPhase = "bulk" | "cut" | "maintain";

export interface UserProfile {
  current_weight: number;
  goal_weight: number;
  months_to_goal: number;
  phase: GoalPhase;
  target_weekly_change_lbs: number;
  goal_start_date?: string;
  goal_start_weight?: number;
  updated_at: string;
}

export interface WeightEntry {
  weight: number;
  timestamp: string;
  date: string;
}

export type WeightLog = Record<string, WeightEntry>;

export interface FoodLogEntry {
  name: string;
  description: string;
  calories: number;
  protein_grams: number;
  carbs_grams?: number;
  fat_grams?: number;
  price: number;
  location_id: string;
  location_name: string;
  logged_at: string;
  is_custom: boolean;
}

export type DayFoodLog = Record<string, FoodLogEntry>;

/** A reusable food the user saved (e.g. a daily protein shake) — log to any day with one tap. */
export interface InventoryFood {
  name: string;
  calories: number;
  protein_grams: number;
  carbs_grams?: number;
  fat_grams?: number;
  serving?: string;
  price?: number;
  created_at: string;
}
export type FoodInventory = Record<string, InventoryFood>;

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cost: number;
}

export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface PlanMeal {
  meal_type: MealType;
  item_name: string;
  location_id: string;
  location_name: string;
  estimated_calories: number;
  estimated_protein: number;
  estimated_cost: number;
  suggested_time: string;
  reasoning: string;
}

export interface PlanDailyTotals {
  calories: number;
  protein: number;
  cost: number;
}

export interface MealPlan {
  source: "ai" | "manual";
  title: string;
  summary: string;
  meals: PlanMeal[];
  daily_totals: PlanDailyTotals;
  customization?: Record<string, unknown>;
  route_context?: Record<string, unknown>;
  schedule_context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type DayPlanRepo = Record<string, MealPlan>;

export interface ActivePlan {
  plan_id: string;
  source: "ai" | "manual";
  title: string;
  date: string;
  daily_totals: PlanDailyTotals;
  meals: PlanMeal[];
  set_at: string;
}

export interface ClassStop {
  id: string;
  building_label: string;
  start_time: string;
  end_time: string;
  lat: number | null;
  lng: number | null;
  source: string;
}

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type ClassSchedule = Partial<Record<Weekday, ClassStop[]>>;

export type ExerciseType = "weighted" | "bodyweight" | "cardio";

export interface LoggedSet {
  weight: number;
  reps: number;
  distance?: number;      // cardio: miles
  duration_sec?: number;  // cardio / timed: seconds
  comment?: string;       // FitNotes-style per-set note
  is_pr?: boolean;
}

export interface WorkoutLogExercise {
  name: string;
  exercise_id?: string;
  muscle?: string;
  type?: ExerciseType;    // defaults to "weighted"
  tip?: string;
  sets: LoggedSet[];
}

export interface WorkoutLog {
  date: string;
  title: string;
  exercises: WorkoutLogExercise[];
  duration_min?: number;
  source: "manual" | "ai" | "library";
  created_at: string;
}

export interface WorkoutLogItem extends WorkoutLog {
  id: string;
}

export interface ActiveWorkoutTemplate {
  title: string;
  exercises: WorkoutLogExercise[];
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
  resolved_menu_date?: string;
}

export type ChatHistory = Record<string, ChatMessage>;

export interface ChatSessionMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatSessionData {
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Record<string, ChatSessionMessage>;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatSessionMessage[];
}
