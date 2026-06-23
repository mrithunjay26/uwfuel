export const PATHS = {
  profile: (uid: string) => `users/${uid}/profile`,

  weights: (uid: string) => `users/${uid}/weights`,
  weight: (uid: string, dateKey: string) => `users/${uid}/weights/${dateKey}`,

  logs: (uid: string) => `users/${uid}/logs`,
  dayLogs: (uid: string, dateKey: string) => `users/${uid}/logs/${dateKey}`,
  logEntry: (uid: string, dateKey: string, entryId: string) =>
    `users/${uid}/logs/${dateKey}/${entryId}`,

  foodInventory: (uid: string) => `users/${uid}/food_inventory`,
  inventoryItem: (uid: string, id: string) => `users/${uid}/food_inventory/${id}`,

  planRepo: (uid: string) => `users/${uid}/daily_plan_repo`,
  dayPlanRepo: (uid: string, dateKey: string) =>
    `users/${uid}/daily_plan_repo/${dateKey}`,
  planEntry: (uid: string, dateKey: string, planId: string) =>
    `users/${uid}/daily_plan_repo/${dateKey}/${planId}`,

  activePlan: (uid: string) => `users/${uid}/active_plan`,

  classSchedule: (uid: string) => `users/${uid}/class_schedule_by_weekday`,

  chatHistory: (uid: string) => `users/${uid}/chat_history`,

  chatSessions: (uid: string) => `users/${uid}/chat_sessions`,
  chatSession: (uid: string, sessionId: string) =>
    `users/${uid}/chat_sessions/${sessionId}`,
  chatSessionMessages: (uid: string, sessionId: string) =>
    `users/${uid}/chat_sessions/${sessionId}/messages`,

  workoutRepo: (uid: string) => `users/${uid}/weekly_workout_repo`,
  weekWorkoutRepo: (uid: string, weekKey: string) =>
    `users/${uid}/weekly_workout_repo/${weekKey}`,

  activeWorkout: (uid: string) => `users/${uid}/active_workout_plan`,

  exerciseLibrary: (uid: string) => `users/${uid}/exercise_library`,

  workoutLogs: (uid: string) => `users/${uid}/workout_logs`,

  workoutTemplates: (uid: string) => `users/${uid}/workout_templates`,
} as const;
