"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  CalendarCheck2,
  ClipboardList,
  Dumbbell,
  Home,
  MessageSquare,
  Route,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { haptic } from "@/lib/utils/haptics";
import { useConfig } from "@/lib/config/ConfigContext";
import { useCustomize } from "@/lib/customize/CustomizeContext";
import type { FabShape, NavSize, QuickAction } from "@/lib/customize/types";
import { AuroraField } from "@/components/app/AuroraField";
import { InstallBanner } from "@/components/app/InstallBanner";
import { SyncStatus } from "@/components/app/SyncStatus";
import { TutorialProvider } from "@/lib/tutorial/TutorialContext";
import { TutorialOverlay } from "@/components/app/TutorialOverlay";

interface Tab { href: string; label: string; icon: LucideIcon }

const NAV_SIZES: Record<NavSize, { icon: number; item: number; label: string; fab: number; pad: number }> = {
  compact: { icon: 19, item: 50, label: "text-[9px]",  fab: 52, pad: 84 },
  default: { icon: 22, item: 58, label: "text-[10px]", fab: 60, pad: 94 },
  large:   { icon: 25, item: 66, label: "text-[11px]", fab: 70, pad: 104 },
};

const FAB_RADIUS: Record<FabShape, string> = {
  circle: "rounded-full",
  squircle: "rounded-2xl",
  square: "rounded-[14px]",
};

const NAV_PAGES: Record<QuickAction, Tab> = {
  dashboard: { href: "/dashboard", label: "Home",     icon: Home },
  menu:      { href: "/menu",      label: "Dining",   icon: UtensilsCrossed },
  plan:      { href: "/plan",      label: "Plan",     icon: CalendarCheck2 },
  today:     { href: "/today",     label: "My Day",   icon: Route },
  chat:      { href: "/chat",      label: "Chat",     icon: MessageSquare },
  progress:  { href: "/progress",  label: "Progress", icon: BarChart2 },
  workout:   { href: "/workout",   label: "Train",    icon: Dumbbell },
  log:       { href: "/log",       label: "Log",      icon: ClipboardList },
};
const WORKOUT_PAGES: QuickAction[] = ["workout", "log"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { showWorkoutTabs } = useConfig();
  const { customize } = useCustomize();
  const dims = NAV_SIZES[customize.navSize] ?? NAV_SIZES.default;
  const primaryKey: QuickAction = customize.primaryAction in NAV_PAGES ? customize.primaryAction : "plan";
  const primary = NAV_PAGES[primaryKey];
  const secondary = NAV_PAGES[customize.secondaryAction] ?? NAV_PAGES.log;
  const PrimaryIcon = primary.icon;
  const SecondaryIcon = secondary.icon;
  const primaryActive = isRouteActive(pathname, primary.href);
  const navTop = customize.navPosition === "top";
  const workoutOled = pathname.startsWith("/log") && customize.workoutOled;

  const hidden = new Set<string>(customize.navHidden ?? []);
  const tabs = (Object.keys(NAV_PAGES) as QuickAction[])
    .filter((key) => key !== primaryKey)
    .filter((key) => showWorkoutTabs || !WORKOUT_PAGES.includes(key))
    .filter((key) => !hidden.has(key))
    .map((key) => NAV_PAGES[key]);
  const split = Math.ceil(tabs.length / 2);
  const leftTabs = tabs.slice(0, split);
  const rightTabs = tabs.slice(split);

  const isActive = (href: string) => isRouteActive(pathname, href);

  return (
    <TutorialProvider>
    <div className={`relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col ${workoutOled ? "workout-oled" : ""}`}>
      {!workoutOled && <AuroraField />}
      <TutorialOverlay />

      <div
        className="flex-1"
        style={navTop
          ? { paddingTop: `calc(${dims.pad}px + env(safe-area-inset-top))` }
          : { paddingBottom: `calc(${dims.pad}px + env(safe-area-inset-bottom))` }}
      >
        <div key={pathname} className="page-anim">{children}</div>
      </div>

      <SyncStatus />
      <InstallBanner />

      <nav className={`app-navigation fixed inset-x-0 z-40 ${navTop ? "top-0" : "bottom-0"}`}>
        <div className={`relative mx-auto max-w-[480px] px-3 ${navTop ? "pt-[max(env(safe-area-inset-top),8px)]" : "pb-[max(env(safe-area-inset-bottom),10px)]"}`}>
          {customize.showReachShortcut && secondary.href !== primary.href && (
            <Link
              href={secondary.href}
              onClick={() => haptic("light")}
              aria-label={`Quick open ${secondary.label}`}
              className={`press tap-target absolute z-10 grid size-10 place-items-center rounded-full border border-line bg-surface/90 text-accent shadow-[var(--shadow-md)] backdrop-blur-xl ${customize.handedness === "left" ? "left-4" : "right-4"} ${navTop ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]"}`}
            >
              <SecondaryIcon className="size-[18px]" />
            </Link>
          )}
          <div className="glass-nav relative flex items-center gap-0.5 rounded-[26px] px-2 py-2.5">
            <div className="flex min-w-0 flex-1 items-center justify-around">
              {leftTabs.map((t) => (
                <NavItem key={t.href} {...t} active={isActive(t.href)} dims={dims} showLabel={customize.navLabels} />
              ))}
            </div>

            <Link
              href={primary.href}
              onClick={() => haptic("medium")}
              className={cn(
                "press mx-1 grid shrink-0 place-items-center shadow-[var(--shadow-fab)]",
                customize.navMode === "fab" && (navTop ? "translate-y-3" : "-translate-y-3"),
                FAB_RADIUS[customize.fabShape] ?? FAB_RADIUS.squircle,
                primaryActive
                  ? "bg-accent text-accent-contrast ring-2 ring-accent/40 ring-offset-2 ring-offset-transparent"
                  : "bg-accent text-accent-contrast",
              )}
              aria-label={primary.label}
              style={{ width: dims.fab, height: dims.fab, minWidth: dims.fab }}
            >
              <PrimaryIcon style={{ width: dims.icon + 1, height: dims.icon + 1 }} strokeWidth={primaryActive ? 2.5 : 2} />
            </Link>

            <div className="flex min-w-0 flex-1 items-center justify-around">
              {rightTabs.map((t) => (
                <NavItem key={t.href} {...t} active={isActive(t.href)} dims={dims} showLabel={customize.navLabels} />
              ))}
            </div>
          </div>
        </div>
      </nav>
    </div>
    </TutorialProvider>
  );
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  dims,
  showLabel,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  dims: { icon: number; item: number; label: string };
  showLabel: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={() => haptic("light")}
      aria-label={label}
      data-tour={`nav-${href.slice(1)}`}
      className={cn(
        "press relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5 font-semibold transition",
        dims.label,
        active ? "text-accent" : "text-ink-faint",
      )}
      style={{ maxWidth: dims.item + 12, minHeight: dims.item }}
    >
      {active && (
        <span aria-hidden className="absolute inset-x-0.5 inset-y-1 rounded-[15px] bg-accent-soft transition" />
      )}
      <span className="relative z-10 flex flex-col items-center gap-1">
        <Icon style={{ width: dims.icon, height: dims.icon }} strokeWidth={active ? 2.5 : 2} />
        {showLabel && <span className="max-w-full truncate">{label}</span>}
      </span>
    </Link>
  );
}
