import type { Weekday, WorkoutLogExercise, WorkoutPlanDay } from "@/lib/db/types";
import type { AIWorkoutDay } from "@/lib/workout/parse";

export const WEEKDAYS: Weekday[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

export function emptyWorkoutWeek(): WorkoutPlanDay[] {
  return WEEKDAYS.map((weekday) => ({ weekday, label: "Rest", is_rest: true, exercises: [] }));
}

export function generatedDaysToWeek(days: AIWorkoutDay[]): WorkoutPlanDay[] {
  const week = emptyWorkoutWeek();
  days.slice(0, 7).forEach((day, index) => {
    week[index] = {
      weekday: WEEKDAYS[index],
      label: day.label || `Workout ${index + 1}`,
      is_rest: false,
      exercises: day.exercises.map(cloneTemplateExercise),
    };
  });
  return week;
}

export function workoutDayForDate(days: WorkoutPlanDay[], dateKey: string): WorkoutPlanDay | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  const weekday = WEEKDAYS[(date.getDay() + 6) % 7];
  return days.find((item) => item.weekday === weekday) ?? null;
}

export function cloneTemplateExercise(exercise: WorkoutLogExercise): WorkoutLogExercise {
  return { ...exercise, sets: (exercise.sets ?? []).map((set) => ({ ...set })) };
}

export function loggerExercisesFromPlan(day: WorkoutPlanDay): WorkoutLogExercise[] {
  return day.exercises.map((exercise) => {
    const target = exercise.sets?.[0];
    const targetText = exercise.sets?.length
      ? `Target: ${exercise.sets.length} × ${target?.reps || "—"}${exercise.tip ? ` · ${exercise.tip}` : ""}`
      : exercise.tip;
    return { ...exercise, ...(targetText ? { tip: targetText } : {}), sets: [] };
  });
}
