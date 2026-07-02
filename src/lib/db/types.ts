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
  funding_source?: FoodFundingSource;
  expense_id?: string;
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
  source?: "grocery" | "recipe" | "campus" | "other";
  kitchen_required?: KitchenAccess;
  created_at: string;
}
export type FoodInventory = Record<string, InventoryFood>;

export type HousingContext = "residence_hall" | "campus_apartment" | "commuter_off_campus" | "other";
export type KitchenAccess = "none" | "shared" | "full";
export type FoodFundingSource = "dining_plan" | "husky_card" | "personal" | "unknown";
export type FoodExpenseCategory = "campus_meal" | "off_campus_meal" | "groceries" | "other_food";
export type DietaryStyle = "halal" | "vegan" | "vegetarian" | "gluten_sensitive";

export interface DiningPlanSelection {
  catalog_year: string;
  program: "residence" | "apartment";
  level: string;
  quarterly_amount: number;
  daily_guide: number | null;
  intended_usage: string;
}

export interface DiningPlanWallet {
  selection: DiningPlanSelection | null;
  quarter_key: string;
  quarter_start: string;
  quarter_end: string;
  current_balance?: number;
  balance_as_of?: string;
}

export interface PersonalFoodWallet {
  monthly_budget: number;
  grocery_target?: number;
  cycle_day: number;
}

export interface CookingProfile {
  kitchen_access: KitchenAccess;
  cooked_meals_per_week: number;
}

export interface DietarySafetyProfile {
  styles: DietaryStyle[];
  allergens: string[];
  hard_exclusions: string[];
  dislikes: string[];
  cross_contact_sensitive: boolean;
  allow_unknown: boolean;
}

export interface OnboardingProfile {
  setup_version: number;
  completed_at: string;
  housing: HousingContext;
  dining_wallet: DiningPlanWallet;
  personal_wallet: PersonalFoodWallet;
  cooking: CookingProfile;
  dietary: DietarySafetyProfile;
  checklist_hidden?: boolean;
  updated_at: string;
}

export interface FoodExpense {
  amount: number;
  category: FoodExpenseCategory;
  funding_source: FoodFundingSource;
  occurred_at: string;
  date: string;
  description: string;
  linked_log_id?: string;
}

export interface ReadinessCheck {
  date: string;
  sleep: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  updated_at: string;
}

export interface WorkoutScheduleOverride {
  date: string;
  action: "skip" | "move" | "replace";
  moved_to?: string;
  day?: WorkoutPlanDay;
  updated_at: string;
}

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
  title?: string;
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

export interface WorkoutPlanDay {
  weekday: Weekday;
  label: string;
  is_rest: boolean;
  exercises: WorkoutLogExercise[];
}

/** A reusable, indefinitely recurring seven-day training schedule. */
export interface WorkoutPlan {
  title: string;
  split: string;
  source: "ai" | "manual";
  days: WorkoutPlanDay[];
  created_at: string;
  updated_at: string;
}

export interface WorkoutPlanItem extends WorkoutPlan {
  id: string;
}

export interface ActiveWorkoutPlan extends WorkoutPlan {
  plan_id: string;
  set_at: string;
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
