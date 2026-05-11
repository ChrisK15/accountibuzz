import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar, CTA } from "../primitives";
import { ChevronLeft } from "../groups/primitives";
import { Check, X, AlertTriangle } from "lucide-react";

/* ============ HEADER ============ */
function ReviewHeader({ groupName }: { groupName: string }) {
  return (
    <div className="px-2 pt-1 pb-2 flex items-center gap-1">
      <button className="w-10 h-10 rounded-pill flex items-center justify-center text-foreground">
        <ChevronLeft size={24} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-h2 text-foreground leading-tight">Pending review</h1>
        <p className="text-caption font-medium text-muted-foreground truncate">{groupName}</p>
      </div>
      <span className="w-10" />
    </div>
  );
}

/* ============ MEDIA PLACEHOLDERS ============ */
function PhotoMedia() {
  return (
    <div
      className="w-full rounded-md overflow-hidden"
      style={{
        aspectRatio: "4 / 3",
        background:
          "linear-gradient(160deg, hsl(28 55% 60%) 0%, hsl(15 50% 35%) 50%, hsl(220 30% 15%) 100%)",
      }}
    >
      <div className="w-full h-full relative">
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-[28%] w-32 h-32 rounded-pill opacity-60"
          style={{
            background: "radial-gradient(circle at 35% 30%, hsl(40 60% 75%), hsl(20 30% 22%))",
          }}
        />
      </div>
    </div>
  );
}

function VideoMedia() {
  return (
    <div
      className="w-full rounded-md overflow-hidden relative"
      style={{
        aspectRatio: "16 / 9",
        background:
          "linear-gradient(180deg, hsl(220 30% 22%) 0%, hsl(220 25% 14%) 60%, hsl(220 30% 8%) 100%)",
      }}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[24%] w-24 h-24 rounded-pill opacity-50"
        style={{ background: "radial-gradient(circle at 40% 35%, hsl(35 60% 70%), hsl(20 30% 18%))" }}
      />
      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-sm bg-black/55 text-white text-[10px] font-bold">
        0:08
      </span>
    </div>
  );
}

/* ============ REVIEW CARD ============ */
type CardProps = {
  name: string;
  ago: string;
  caption?: string;
  media?: "photo" | "video";
  className?: string;
  style?: React.CSSProperties;
  overlay?: "approve" | "reject" | null;
  children?: ReactNode;
};

function ReviewCard({
  name,
  ago,
  caption,
  media = "photo",
  className,
  style,
  overlay,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface shadow-e2 p-4 w-[92%] mx-auto relative overflow-hidden",
        className,
      )}
      style={style}
    >
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={name} size={40} />
        <div className="min-w-0">
          <p className="text-body font-bold text-foreground truncate">{name}</p>
          <p className="text-caption font-medium text-muted-foreground">submitted {ago}</p>
        </div>
      </div>
      {media === "photo" ? <PhotoMedia /> : <VideoMedia />}
      {caption && (
        <p className="mt-3 text-body text-foreground italic line-clamp-3">"{caption}"</p>
      )}

      {/* swipe overlays */}
      {overlay === "approve" && (
        <div className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none">
          <span
            className="w-20 h-20 rounded-pill flex items-center justify-center text-primary-foreground shadow-e2"
            style={{ background: "hsl(145 60% 45%)" }}
          >
            <Check size={42} strokeWidth={3.5} />
          </span>
        </div>
      )}
      {overlay === "reject" && (
        <div className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none">
          <span className="w-20 h-20 rounded-pill flex items-center justify-center bg-destructive text-destructive-foreground shadow-e2">
            <X size={42} strokeWidth={3.5} />
          </span>
        </div>
      )}
    </div>
  );
}

/* ============ STACK (top + 2 peeking behind) ============ */
function CardStack({
  topOverlay,
  topOffsetX = 0,
  topRotate = 0,
  topOpacity = 1,
}: {
  topOverlay?: "approve" | "reject" | null;
  topOffsetX?: number;
  topRotate?: number;
  topOpacity?: number;
}) {
  return (
    <div className="relative h-[360px] mt-4">
      {/* card 3 (back) */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: "translateY(12px) scale(0.94)", opacity: 0.8 }}
      >
        <ReviewCard name="Sam Patel" ago="9m ago" media="photo" />
      </div>
      {/* card 2 */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: "translateY(6px) scale(0.97)", opacity: 0.9 }}
      >
        <ReviewCard name="Maya Chen" ago="6m ago" media="video" />
      </div>
      {/* top card */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          transform: `translateX(${topOffsetX}px) rotate(${topRotate}deg)`,
          opacity: topOpacity,
        }}
      >
        <ReviewCard
          name="Casey Chen"
          ago="4m ago"
          caption="Mile 3 done before sunrise"
          media="photo"
          overlay={topOverlay}
        />
      </div>
    </div>
  );
}

/* ============ FALLBACK BUTTON ROW ============ */
function ActionButtons() {
  return (
    <div className="px-5 mt-6 flex gap-3">
      <button className="flex-1 h-13 min-h-[52px] rounded-md font-bold text-body inline-flex items-center justify-center gap-2 bg-transparent text-foreground border-2 border-foreground/15">
        <X size={20} strokeWidth={2.5} />
        Reject
      </button>
      <button className="flex-1 h-13 min-h-[52px] rounded-md font-bold text-body inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground shadow-e1">
        <Check size={20} strokeWidth={2.5} />
        Approve
      </button>
    </div>
  );
}

function PendingCount({ n }: { n: number }) {
  return (
    <p className="mt-5 text-center text-caption font-medium text-muted-foreground">
      {n} pending in this group
    </p>
  );
}

/* ============ REVIEW QUEUE — IDLE TOP CARD ============ */
export function ReviewQueueScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ReviewHeader groupName="Morning runners" />
      <div className="flex-1 overflow-hidden">
        <CardStack />
        <ActionButtons />
        <PendingCount n={3} />
      </div>
    </div>
  );
}

/* ============ REVIEW QUEUE — MID-SWIPE RIGHT (APPROVE) ============ */
export function ReviewQueueSwipingApproveScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ReviewHeader groupName="Morning runners" />
      <div className="flex-1 overflow-hidden">
        <CardStack topOverlay="approve" topOffsetX={70} topRotate={6} />
        <ActionButtons />
        <PendingCount n={3} />
      </div>
    </div>
  );
}

/* ============ REVIEW QUEUE — MID-SWIPE LEFT (REJECT) ============ */
export function ReviewQueueSwipingRejectScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ReviewHeader groupName="Morning runners" />
      <div className="flex-1 overflow-hidden">
        <CardStack topOverlay="reject" topOffsetX={-70} topRotate={-6} />
        <ActionButtons />
        <PendingCount n={3} />
      </div>
    </div>
  );
}

/* ============ REVIEW QUEUE — REJECT REASON PANEL ============ */
export function ReviewQueueRejectReasonScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ReviewHeader groupName="Morning runners" />
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* card pulled off-screen-left, faded */}
        <div className="relative h-[180px] mt-4 overflow-hidden">
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: "translateY(12px) scale(0.94)", opacity: 0.8 }}
          >
            <ReviewCard name="Sam Patel" ago="9m ago" media="photo" />
          </div>
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: "translateY(6px) scale(0.97)", opacity: 0.9 }}
          >
            <ReviewCard name="Maya Chen" ago="6m ago" media="video" />
          </div>
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: "translateX(-30%) rotate(-8deg)", opacity: 0.6 }}
          >
            <ReviewCard
              name="Casey Chen"
              ago="4m ago"
              caption="Mile 3 done before sunrise"
              media="photo"
            />
          </div>
        </div>

        {/* reason panel */}
        <div className="px-5 mt-4">
          <label className="block text-caption font-bold text-neutral-high">
            Tell Casey what's off (optional)
          </label>
          <div className="mt-1.5 h-13 min-h-[52px] rounded-md border-2 border-accent ring-2 ring-accent/30 bg-surface px-3 flex items-center gap-2">
            <input
              readOnly
              placeholder="e.g. that's not today's run"
              className="flex-1 bg-transparent outline-none text-body text-foreground placeholder:text-muted-foreground"
            />
            <span
              className="text-caption font-medium text-muted-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              0/140
            </span>
          </div>

          <div className="mt-3 rounded-md bg-muted border border-border p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-foreground mt-0.5 shrink-0" />
            <p className="text-body text-foreground leading-snug">
              This rejection is final for today — Casey can't resubmit. Streak resets at midnight in PT.
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <div className="flex-1">
              <CTA variant="ghost">Never mind</CTA>
            </div>
            <div className="flex-1">
              <CTA variant="destructive">Reject</CTA>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ REVIEW QUEUE — EMPTY ============ */
export function ReviewQueueEmptyScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ReviewHeader groupName="Morning runners" />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div
          className="w-20 h-20 rounded-pill flex items-center justify-center text-primary-foreground"
          style={{ background: "hsl(145 60% 45%)" }}
        >
          <Check size={36} strokeWidth={3} />
        </div>
        <h2 className="mt-6 text-h1 text-foreground">All caught up</h2>
        <p className="mt-2 text-body font-medium text-muted-foreground">
          Nothing's waiting on you.
        </p>
        <div className="mt-8 w-full max-w-xs">
          <CTA variant="primary">Back to group</CTA>
        </div>
      </div>
    </div>
  );
}

/* ============ REVIEW QUEUE — LOADING SKELETON ============ */
function SkeletonCard({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      className="rounded-lg bg-surface shadow-e2 p-4 w-[92%] mx-auto"
      style={style}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-pill bg-muted animate-pulse" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-32 rounded-sm bg-muted animate-pulse" />
          <div className="h-3 w-20 rounded-sm bg-muted animate-pulse" />
        </div>
      </div>
      <div
        className="w-full rounded-md bg-muted animate-pulse"
        style={{ aspectRatio: "4 / 3" }}
      />
    </div>
  );
}

export function ReviewQueueLoadingScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ReviewHeader groupName="Morning runners" />
      <div className="flex-1 overflow-hidden">
        <div className="relative h-[360px] mt-4">
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: "translateY(12px) scale(0.94)", opacity: 0.8 }}
          >
            <SkeletonCard />
          </div>
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: "translateY(6px) scale(0.97)", opacity: 0.9 }}
          >
            <SkeletonCard />
          </div>
          <div className="absolute inset-x-0 top-0">
            <SkeletonCard />
          </div>
        </div>
        <ActionButtons />
      </div>
    </div>
  );
}

/* ============ REVIEW QUEUE — RPC ERROR ============ */
export function ReviewQueueErrorScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ReviewHeader groupName="Morning runners" />
      <div className="flex-1 overflow-hidden">
        <CardStack />
        <div className="px-5 mt-4">
          <p className="rounded-md bg-destructive/15 text-destructive font-bold text-caption px-3 py-2 text-center">
            Couldn't save that decision. Try again.
          </p>
        </div>
        <ActionButtons />
        <PendingCount n={3} />
      </div>
    </div>
  );
}

/* ============ FIRST-REVIEW TOOLTIP MODAL ============ */
export function ReviewFirstTimeTooltipScreen() {
  return (
    <div className="h-full bg-background flex flex-col relative">
      <ReviewHeader groupName="Morning runners" />
      <div className="flex-1 overflow-hidden">
        <CardStack />
        <ActionButtons />
        <PendingCount n={3} />
      </div>
      {/* dim + modal */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="absolute inset-x-0 bottom-0 p-4 pb-8">
        <div className="rounded-lg bg-surface shadow-e2 p-5">
          <h2 className="text-h2 text-foreground">How review works</h2>
          <ul className="mt-3 space-y-2.5">
            <li className="flex gap-2.5 text-body text-foreground">
              <span
                className="w-5 h-5 mt-0.5 rounded-pill flex items-center justify-center shrink-0 text-primary-foreground"
                style={{ background: "hsl(145 60% 45%)" }}
              >
                <Check size={12} strokeWidth={3.5} />
              </span>
              Swipe right or tap Approve — the submission counts.
            </li>
            <li className="flex gap-2.5 text-body text-foreground">
              <span className="w-5 h-5 mt-0.5 rounded-pill flex items-center justify-center shrink-0 bg-destructive text-destructive-foreground">
                <X size={12} strokeWidth={3.5} />
              </span>
              Swipe left or tap Reject — today won't count for that member. They can't resubmit.
            </li>
            <li className="flex gap-2.5 text-body text-foreground">
              <span className="w-5 h-5 mt-0.5 rounded-pill flex items-center justify-center shrink-0 bg-primary text-primary-foreground text-[11px] font-extrabold">
                ✎
              </span>
              Add an optional one-line note when you reject so they know what's off.
            </li>
          </ul>
          <div className="mt-5">
            <CTA variant="primary">Got it</CTA>
          </div>
        </div>
      </div>
    </div>
  );
}
