import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ============ PHONE FRAME ============ */
export function Phone({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={cn(dark && "dark")}>
      <div className="phone-frame">
        <div className="phone-screen flex flex-col">
          <StatusBar />
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="phone-status-bar text-foreground">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span>•••</span>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <path d="M1 1l7 8 7-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="ml-1 inline-block w-6 h-3 rounded-sm border border-current relative">
          <span className="absolute inset-0.5 bg-current rounded-[1px]" />
        </span>
      </span>
    </div>
  );
}

/* ============ HEADER ============ */
export function ScreenHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <h2 className="text-h2 text-foreground">{title}</h2>
      {action ? <div>{action}</div> : <div className="w-10" />}
    </div>
  );
}

/* ============ BUTTONS ============ */
type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";

export function CTA({
  children,
  variant = "primary",
  loading = false,
  pressed = false,
  className,
  full = true,
}: {
  children?: ReactNode;
  variant?: BtnVariant;
  loading?: boolean;
  pressed?: boolean;
  className?: string;
  full?: boolean;
}) {
  const base = "h-13 min-h-[52px] rounded-md font-bold text-body inline-flex items-center justify-center px-6 transition-colors select-none";
  const variants: Record<BtnVariant, string> = {
    primary: cn(
      "bg-primary text-primary-foreground shadow-e1",
      pressed && "bg-primary-pressed",
    ),
    secondary: cn(
      "bg-transparent text-foreground border-2 border-foreground/15",
      pressed && "border-foreground/30 bg-foreground/5",
    ),
    ghost: cn(
      "bg-transparent text-accent",
      pressed && "bg-accent/10",
    ),
    destructive: cn(
      "bg-destructive text-destructive-foreground",
      pressed && "opacity-90",
    ),
  };
  return (
    <button
      type="button"
      className={cn(base, full && "w-full", variants[variant], className)}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-5 h-5 rounded-full border-[2.5px] border-current border-t-transparent animate-spin",
        className,
      )}
    />
  );
}

/* ============ TEXT INPUT ============ */
export function Field({
  label,
  value = "",
  placeholder,
  type = "text",
  state = "default",
  helper,
  trailing,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  type?: string;
  state?: "default" | "focused" | "error" | "disabled";
  helper?: string;
  trailing?: ReactNode;
}) {
  const ring =
    state === "focused"
      ? "border-accent ring-2 ring-accent/30"
      : state === "error"
      ? "border-destructive ring-2 ring-destructive/25"
      : state === "disabled"
      ? "border-border bg-muted/60 opacity-70"
      : "border-input";
  return (
    <div className="space-y-1.5">
      <label className="block text-caption font-semibold text-neutral-high">{label}</label>
      <div
        className={cn(
          "h-13 min-h-[52px] rounded-md border-2 bg-surface px-4 flex items-center gap-2 transition-colors",
          ring,
        )}
      >
        <input
          readOnly
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={state === "disabled"}
          className="flex-1 bg-transparent outline-none text-body text-foreground placeholder:text-muted-foreground"
        />
        {trailing}
      </div>
      {helper && (
        <p
          className={cn(
            "text-caption",
            state === "error" ? "text-destructive font-semibold" : "text-muted-foreground",
          )}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

/* ============ AVATAR ============ */
const AVATAR_PALETTE = [
  "hsl(51 100% 63%)",   // primary
  "hsl(197 86% 64%)",   // accent
  "hsl(14 88% 65%)",    // coral
  "hsl(280 65% 68%)",   // lavender
  "hsl(145 55% 55%)",   // green
  "hsl(35 95% 60%)",    // amber
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({
  name = "",
  src,
  size = 96,
  ring = false,
}: {
  name?: string;
  src?: string;
  size?: number;
  ring?: boolean;
}) {
  const bg = hashName(name || "?");
  const fontSize = Math.round(size * 0.36);
  return (
    <div
      className={cn(
        "rounded-pill overflow-hidden flex items-center justify-center font-extrabold text-foreground/85",
        ring && "ring-4 ring-primary/30",
      )}
      style={{ width: size, height: size, background: src ? undefined : bg, fontSize }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: "hsl(220 18% 12%)" }}>{initials(name)}</span>
      )}
    </div>
  );
}

/* ============ MISC ============ */
export function Wordmark({ tagline }: { tagline?: string }) {
  return (
    <div className="text-center pt-6 pb-8">
      <div className="inline-flex items-center gap-1">
        <span className="text-display text-foreground tracking-tight">accounti</span>
        <span className="text-display text-primary-foreground bg-primary px-1.5 rounded-sm tracking-tight">buzz</span>
      </div>
      {tagline && <p className="mt-2 text-caption text-muted-foreground">{tagline}</p>}
    </div>
  );
}

export function TextLink({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "muted" | "destructive" }) {
  const tones = {
    accent: "text-accent",
    muted: "text-muted-foreground",
    destructive: "text-destructive",
  };
  return <span className={cn("text-body font-semibold", tones[tone])}>{children}</span>;
}
