"use client";

// Action variant of Aceternity's FloatingDock (src/components/ui/floating-dock.tsx):
// same macOS magnification and hover tooltip, but buttons with enable/disable
// state, count badges and loading instead of links.

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type DockAction = {
  key: string;
  /** Shown as a tooltip above the icon on hover. */
  label: string;
  /** Short, always-visible label shown below the icon. */
  shortLabel?: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Visual intent of the icon. */
  tone?: "default" | "danger" | "success" | "warning";
  /** Small count bubble on the icon (hidden when 0 or undefined). */
  badge?: number;
  /** Highlight as toggled on (e.g. an active filter). */
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
};

const TONE_CLASSES: Record<NonNullable<DockAction["tone"]>, string> = {
  default: "text-slate-600",
  danger: "text-red-500",
  success: "text-emerald-600",
  warning: "text-amber-500",
};

const BADGE_CLASSES: Record<NonNullable<DockAction["tone"]>, string> = {
  default: "bg-brand",
  danger: "bg-red-500",
  success: "bg-emerald-600",
  warning: "bg-amber-500",
};

function DockButton({
  action,
  mouseX,
  reducedMotion,
}: {
  action: DockAction;
  mouseX: MotionValue<number>;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const usable = !action.disabled && !action.loading;

  const distance = useTransform(mouseX, (value) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return value - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [44, 72, 44]);
  const iconTransform = useTransform(distance, [-150, 0, 150], [20, 32, 20]);
  const width = useSpring(widthTransform, { mass: 0.1, stiffness: 150, damping: 12 });
  const iconSize = useSpring(iconTransform, { mass: 0.1, stiffness: 150, damping: 12 });

  const magnify = usable && !reducedMotion;

  return (
    <div className="flex min-w-11 flex-col items-center gap-1">
      <motion.button
        ref={ref}
        type="button"
        style={magnify ? { width, height: width } : { width: 44, height: 44 }}
        aria-label={action.label}
        aria-pressed={action.active}
        disabled={!usable}
        onClick={action.onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-full transition-colors",
          usable ? "bg-white/80 shadow-sm ring-1 ring-slate-900/10 hover:bg-white" : "cursor-not-allowed bg-white/40 ring-1 ring-slate-900/5",
          action.active && "bg-brand/5 ring-brand/30",
        )}
      >
        <AnimatePresence>
          {hovered && usable && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 2, x: "-50%" }}
              className="pointer-events-none absolute -top-9 left-1/2 w-fit whitespace-pre rounded-md border border-slate-200/80 bg-white/95 px-2.5 py-1 text-xs font-semibold text-brand shadow-sm backdrop-blur"
            >
              {action.label}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={magnify ? { width: iconSize, height: iconSize } : { width: 20, height: 20 }}
          className={cn(
            "flex items-center justify-center [&>svg]:h-full [&>svg]:w-full",
            usable ? TONE_CLASSES[action.tone ?? "default"] : "text-slate-300",
          )}
        >
          {action.loading ? <IconLoader2 className="animate-spin" /> : action.icon}
        </motion.div>
        {usable && (action.badge ?? 0) > 0 && (
          <motion.span
            key={action.badge}
            initial={reducedMotion ? false : { scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={cn(
              "absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white",
              BADGE_CLASSES[action.tone ?? "default"],
            )}
          >
            {action.badge}
          </motion.span>
        )}
      </motion.button>
      <span
        aria-hidden="true"
        className={cn(
          "max-w-16 truncate text-[10px] font-semibold leading-none",
          usable ? TONE_CLASSES[action.tone ?? "default"] : "text-slate-300",
        )}
      >
        {action.shortLabel ?? action.label}
      </span>
    </div>
  );
}

/** Floating glassmorphism dock, bottom-center. Actions stay in place and simply
 * enable or disable with context. */
export function ActionDock({ actions }: { actions: DockAction[] }) {
  const reducedMotion = useReducedMotion() ?? false;
  const mouseX = useMotionValue(Infinity);

  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
      role="toolbar"
      aria-label="Actions"
    >
      <motion.div
        onMouseMove={(event) => mouseX.set(event.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex h-20 items-end gap-3 rounded-2xl border border-white/60 bg-white/60 px-4 pb-2.5 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur-xl"
      >
        {actions.map((action) => (
          <DockButton key={action.key} action={action} mouseX={mouseX} reducedMotion={reducedMotion} />
        ))}
      </motion.div>
    </motion.div>
  );
}
