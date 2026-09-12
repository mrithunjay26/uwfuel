export interface TourStep {
  id: string;
  route?: string;
  target?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to UW Fuel",
    body: "A quick tour of how the pieces fit together — eat well, train, and stay on budget. Skip anytime.",
  },
  {
    id: "dining",
    route: "/menu",
    target: "nav-menu",
    title: "Start with Dining",
    body: "Live UW dining menus with prices, macros, and what's open right now. Everything the planner uses comes from here.",
  },
  {
    id: "plan",
    route: "/plan",
    target: "plan-generate",
    title: "Build your day",
    body: "The planner picks real menu items that fit your budget and calorie target, close to your classes. Tap here to generate one.",
  },
  {
    id: "log",
    route: "/dashboard",
    target: "log-fab",
    title: "Log what you eat",
    body: "Log a meal with this button. Rate dining meals Bad, Good, or Loved and the planner learns your taste over time.",
  },
  {
    id: "progress",
    route: "/progress",
    target: "progress-chart",
    title: "See your trends",
    body: "Every chart is interactive: drag to pan, pinch or scroll to zoom, and tap any day to see exactly what you ate.",
  },
  {
    id: "today",
    route: "/today",
    target: "nav-today",
    title: "My Day",
    body: "Your route across campus with meals timed to the gaps between classes — plus one reminder 30 minutes before each.",
  },
  {
    id: "customize",
    route: "/profile",
    target: "customize",
    title: "Make it yours",
    body: "Themes, layout, map style, and meal timing all live here. You can replay this tour from Settings whenever you like.",
  },
  {
    id: "done",
    title: "You're all set",
    body: "That's the tour. Nothing is locked in — explore and tweak as you go.",
  },
];
