import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Camera,
  Video,
  Check,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  X,
  Share2,
  Copy,
  Users,
  Clock,
} from "lucide-react";

/* Re-export icons for convenience in screen files */
export {
  Camera,
  Video,
  Check,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  X,
  Share2,
  Copy,
  Users,
  Clock,
};

/* ============ SEGMENTED CONTROL ============ */
export function Segmented<T extends string>({
  options,
  value,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
}) {
  return (
    <div className="flex p-1 rounded-md bg-muted gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={cn(
              "flex-1 h-11 rounded-sm flex items-center justify-center gap-2 text-body font-bold transition-colors",
              active
                ? "bg-surface text-foreground shadow-e1"
                : "text-muted-foreground",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============ ADMIN BADGE ============ */
export function AdminBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-primary text-primary-foreground text-[11px] font-extrabold tracking-wide uppercase">
      Admin
    </span>
  );
}

/* ============ META CHIP ============ */
export function MetaChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-muted text-neutral-high text-caption font-semibold">
      {icon}
      {children}
    </span>
  );
}

/* ============ ROW CARD ============ */
export function RowCard({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-md bg-surface border border-border p-4 flex items-center gap-3 active:bg-muted/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ============ INVITE CODE PANEL ============ */
export function InviteCodePanel({ code = "ABCD-EF12" }: { code?: string }) {
  return (
    <div className="rounded-lg bg-surface border border-border shadow-e1 p-5">
      <p className="text-caption text-muted-foreground">Share this code with friends</p>
      <div className="mt-3 mb-4 rounded-md bg-primary/15 px-4 py-4 text-center">
        <div
          className="text-display font-extrabold text-foreground tracking-[0.08em]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {code}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 h-12 min-h-[48px] rounded-md border-2 border-foreground/15 text-foreground font-bold text-body inline-flex items-center justify-center gap-2">
          <Copy size={18} /> Copy code
        </button>
        <button className="flex-1 h-12 min-h-[48px] rounded-md bg-primary text-primary-foreground font-bold text-body inline-flex items-center justify-center gap-2 shadow-e1">
          <Share2 size={18} /> Share
        </button>
      </div>
      <button className="mt-3 w-full h-11 inline-flex items-center justify-center gap-2 text-body font-semibold text-accent">
        <RefreshCw size={16} /> Regenerate code
      </button>
      <p className="mt-1 text-center text-caption text-muted-foreground">Expires in 7 days.</p>
    </div>
  );
}

/* ============ CODE-INPUT BOXES (8 chars: 4 + dash + 4) ============ */
export function CodeInput({
  value = "",
  state = "default",
}: {
  value?: string;
  state?: "default" | "focused" | "error";
}) {
  const chars = value.padEnd(8, " ").split("").slice(0, 8);
  const [a, b] = [chars.slice(0, 4), chars.slice(4, 8)];
  const ringClass =
    state === "error"
      ? "border-destructive"
      : state === "focused"
      ? "border-accent ring-2 ring-accent/30"
      : "border-input";
  return (
    <div className="flex items-center justify-center gap-2">
      {a.map((ch, i) => (
        <Box key={`a${i}`} ch={ch} className={ringClass} active={i === value.length} />
      ))}
      <span className="text-h2 font-extrabold text-muted-foreground">–</span>
      {b.map((ch, i) => (
        <Box key={`b${i}`} ch={ch} className={ringClass} active={i + 4 === value.length} />
      ))}
    </div>
  );
}

function Box({ ch, className, active }: { ch: string; className: string; active?: boolean }) {
  return (
    <div
      className={cn(
        "w-10 h-12 rounded-md border-2 bg-surface flex items-center justify-center text-h2 font-extrabold uppercase font-mono",
        className,
        active && "border-accent ring-2 ring-accent/30",
      )}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {ch.trim() || ""}
    </div>
  );
}

/* ============ MODAL SHEET WRAPPER ============ */
export function SheetShell({
  title,
  onClose,
  rightAction,
  children,
}: {
  title: string;
  onClose?: ReactNode;
  rightAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full bg-background flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        {onClose ?? <button className="text-body font-bold text-accent">Cancel</button>}
        <h2 className="text-h2 text-foreground">{title}</h2>
        {rightAction ?? <div className="w-12" />}
      </div>
      {children}
    </div>
  );
}

/* ============ ICON BUTTON IN HEADER ============ */
export function IconBtn({ children }: { children: ReactNode }) {
  return (
    <button className="w-10 h-10 rounded-pill flex items-center justify-center text-foreground hover:bg-muted">
      {children}
    </button>
  );
}
