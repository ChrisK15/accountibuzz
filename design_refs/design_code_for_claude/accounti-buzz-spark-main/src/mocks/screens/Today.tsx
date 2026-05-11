import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CTA } from "../primitives";
import {
  Camera,
  Video,
  Check,
  Clock,
  ChevronRight,
  Sun,
  Users,
  User,
  UploadCloud,
  MoreHorizontal,
  XCircle,
} from "lucide-react";

/* ============ TAB BAR ============ */
type Tab = "today" | "groups" | "profile";

export function TabBar({ active = "today" }: { active?: Tab }) {
  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "today", label: "Today", icon: <Sun size={22} strokeWidth={2} /> },
    { id: "groups", label: "Groups", icon: <Users size={22} strokeWidth={2} /> },
    { id: "profile", label: "Profile", icon: <User size={22} strokeWidth={2} /> },
  ];
  return (
    <div className="border-t border-border bg-surface">
      <div className="flex h-14 px-2 pb-1">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <div key={t.id} className="flex-1 flex flex-col items-center justify-center relative">
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-sm" />
              )}
              <span className={cn("mt-1", isActive ? "text-foreground" : "text-muted-foreground")}>
                {t.icon}
              </span>
              <span
                className={cn(
                  "text-[11px] mt-0.5 leading-none",
                  isActive ? "text-foreground font-bold" : "text-muted-foreground font-medium",
                )}
              >
                {t.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1 flex justify-center pb-1">
        <span className="w-32 h-1 rounded-pill bg-foreground/80" />
      </div>
    </div>
  );
}

/* ============ TYPE CHIP ============ */
export function TypeChip({ kind }: { kind: "photo" | "video" }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-muted border border-border text-caption font-medium text-foreground">
      {kind === "photo" ? <Camera size={13} /> : <Video size={13} />}
      {kind === "photo" ? "Photo" : "Video"}
    </span>
  );
}

/* ============ STATUS PILL ============ */
type Status = "none" | "pending" | "approved" | "rejected";

export function StatusPill({ status }: { status: Status }) {
  if (status === "none") {
    return <span className="text-caption font-medium text-muted-foreground">—</span>;
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-muted border border-border text-caption font-medium text-foreground">
        <Clock size={12} />
        Pending review
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-primary text-primary-foreground text-caption font-bold">
        <Check size={12} strokeWidth={3} />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-destructive/10 text-destructive text-caption font-medium">
      <XCircle size={12} />
      Today didn't count
    </span>
  );
}

/* ============ CUTOFF HINT ============ */
export function CutoffHint({
  cutoff,
  minutesLeft,
  submittedAgo,
}: {
  cutoff?: string;
  minutesLeft?: number;
  submittedAgo?: string;
}) {
  if (submittedAgo) {
    return (
      <span className="text-caption font-medium text-muted-foreground">
        Submitted {submittedAgo}
      </span>
    );
  }
  if (minutesLeft === undefined) return null;
  const isUrgent = minutesLeft < 60;
  const isCritical = minutesLeft < 5;
  const display =
    minutesLeft >= 60
      ? `${Math.floor(minutesLeft / 60)}h left`
      : `${minutesLeft}m left`;
  return (
    <span
      className={cn(
        "text-caption",
        isCritical && "text-destructive font-bold",
        !isCritical && isUrgent && "text-destructive font-medium",
        !isUrgent && "text-muted-foreground font-medium",
      )}
    >
      {cutoff} cutoff ({display})
    </span>
  );
}

/* ============ QUEUE BADGE ============ */
export function QueueBadge({ size = "2.4 MB" }: { size?: string }) {
  return (
    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
      <UploadCloud size={16} className="text-muted-foreground" />
      <span className="flex-1 text-caption font-medium text-foreground">
        Upload pending — {size} queued
      </span>
      <button className="w-8 h-8 rounded-pill flex items-center justify-center text-muted-foreground">
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}

/* ============ SOCIAL SIGNAL ============ */
export type SocialSignal = {
  posted: number;
  total: number;
  points: number;
  streak: number;
};

function SocialSignalLine({ social }: { social: SocialSignal }) {
  const { posted, total, points, streak } = social;
  return (
    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 flex-wrap text-caption font-medium text-muted-foreground">
      {posted === 0 ? (
        <span>
          <span className="tabular-nums">0/{total}</span> posted ·{" "}
          <span className="text-foreground font-semibold">be the first</span>
        </span>
      ) : (
        <span>
          <span className="tabular-nums">{posted}/{total}</span> posted
        </span>
      )}
      <span>·</span>
      <span>
        <span className="font-bold tabular-nums text-foreground">{points}</span> pts
      </span>
      <span>·</span>
      {streak === 0 ? (
        <span className="tabular-nums">0</span>
      ) : (
        <span className="text-foreground">
          🔥<span className="tabular-nums font-semibold">{streak}</span>
        </span>
      )}
    </div>
  );
}

/* ============ GROUP CARD ============ */
type GroupCardProps = {
  name: string;
  goal: string;
  kind: "photo" | "video";
  status: Status;
  cutoff?: string;
  minutesLeft?: number;
  submittedAgo?: string;
  queued?: boolean;
  social?: SocialSignal;
};

export function GroupCard({
  name,
  goal,
  kind,
  status,
  cutoff,
  minutesLeft,
  submittedAgo,
  queued,
  social,
}: GroupCardProps) {
  const ctaNode =
    status === "none" ? (
      <CTA variant="primary">Submit</CTA>
    ) : status === "rejected" ? (
      <div className="relative">
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-pill bg-destructive" />
        <CTA variant="ghost" className="opacity-60 cursor-not-allowed pl-6 justify-start">
          Today didn't count
        </CTA>
      </div>
    ) : (
      <CTA variant="secondary" className="opacity-60 cursor-not-allowed">
        Submitted
      </CTA>
    );

  return (
    <div className="rounded-md bg-surface border border-border shadow-e1 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-h2 text-foreground leading-tight">{name}</h3>
        <TypeChip kind={kind} />
      </div>
      <p className="mt-1 text-body text-muted-foreground line-clamp-1">{goal}</p>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <StatusPill status={status} />
        {(cutoff || submittedAgo) && (
          <>
            <span className="text-caption text-muted-foreground">·</span>
            <CutoffHint cutoff={cutoff} minutesLeft={minutesLeft} submittedAgo={submittedAgo} />
          </>
        )}
      </div>
      <div className="mt-4">{ctaNode}</div>
      {queued && <QueueBadge />}
      {social && <SocialSignalLine social={social} />}
    </div>
  );
}

/* ============ TODAY SCREEN ============ */
export function TodayHeader() {
  return (
    <div className="px-6 pt-3 pb-4">
      <h1 className="text-display text-foreground leading-none">Today</h1>
      <p className="mt-2 text-body font-medium text-muted-foreground">Wednesday, Apr 28</p>
    </div>
  );
}

export function TodayScreen() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <TodayHeader />
        <div className="px-4 space-y-4 pb-6">
          <GroupCard
            name="Morning runners"
            goal="Post a photo of your run before 9am"
            kind="photo"
            status="none"
            cutoff="9:00 AM"
            minutesLeft={240}
          />
          <GroupCard
            name="Evening Spanish"
            goal="10s clip of you reading aloud"
            kind="video"
            status="pending"
            submittedAgo="2m ago"
          />
        </div>
      </div>
      <TabBar active="today" />
    </div>
  );
}

export function TodayScreenAllStates() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <TodayHeader />
        <div className="px-4 space-y-4 pb-6">
          <GroupCard
            name="Morning runners"
            goal="Post a photo of your run before 9am"
            kind="photo"
            status="approved"
            submittedAgo="1h ago"
          />
          <GroupCard
            name="Evening Spanish"
            goal="10s clip of you reading aloud"
            kind="video"
            status="pending"
            submittedAgo="2m ago"
            queued
          />
          <GroupCard
            name="Sunset sketch club"
            goal="One quick doodle, any subject"
            kind="photo"
            status="none"
            cutoff="9:00 PM"
            minutesLeft={47}
          />
          <GroupCard
            name="Cold plunge crew"
            goal="60s in cold water, post the proof"
            kind="video"
            status="none"
            cutoff="10:00 PM"
            minutesLeft={3}
          />
          <GroupCard
            name="Daily pages"
            goal="Write 3 longhand pages, photo of the last one"
            kind="photo"
            status="rejected"
          />
        </div>
      </div>
      <TabBar active="today" />
    </div>
  );
}

export function TodayScreenEmpty() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto flex flex-col">
        <TodayHeader />
        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16 text-center">
          <h2 className="text-h1 text-foreground">No groups yet</h2>
          <p className="mt-2 text-body font-medium text-muted-foreground">
            Create one with friends or join one with a code.
          </p>
          <div className="mt-8 w-full max-w-xs">
            <CTA variant="primary">Create a group</CTA>
            <button className="mt-4 w-full h-12 text-body font-bold text-accent">
              Join with a code
            </button>
          </div>
        </div>
      </div>
      <TabBar active="today" />
    </div>
  );
}

/* ============ GROUP DETAIL · ADMIN PENDING ENTRY ============ */
import { Avatar } from "../primitives";
import { AdminBadge, ChevronLeft, MetaChip, InviteCodePanel } from "../groups/primitives";

const MEMBERS = [
  { name: "Alex Rivera", you: true, admin: true },
  { name: "Maya Chen", you: false, admin: false, src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop" },
  { name: "Sam Patel", you: false, admin: false },
  { name: "Jordan Lee", you: false, admin: false },
];

export function PendingReviewRow({ count }: { count: number }) {
  const display = count > 9 ? "9+" : String(count);
  return (
    <button className="w-full text-left rounded-md bg-surface border border-border shadow-e1 p-4 flex items-center gap-3 active:bg-muted/40">
      <div className="flex-1">
        <h3 className="text-h2 text-foreground leading-tight">Pending review ({display})</h3>
        <p className="mt-0.5 text-body font-medium text-muted-foreground">
          Tap to approve or reject submissions
        </p>
      </div>
      <ChevronRight size={22} className="text-muted-foreground" />
    </button>
  );
}

export function GroupDetailAdminWithPendingScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="px-2 pt-1 pb-1 flex items-center">
        <button className="w-10 h-10 rounded-pill flex items-center justify-center text-foreground">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-h2 text-foreground flex-1 text-center pr-10 truncate">
          Morning Run Club
        </h2>
      </div>
      <div className="px-6 pt-2">
        <h1 className="text-display text-foreground leading-tight">Morning Run Club</h1>
        <p className="mt-2 text-body text-foreground">
          Run at least 1 mile before 9am — rain or shine.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetaChip icon={<Camera size={14} />}>Photo</MetaChip>
          <MetaChip icon={<Clock size={14} />}>PT</MetaChip>
          <MetaChip icon={<Users size={14} />}>4 / 10 members</MetaChip>
        </div>
      </div>

      {/* NEW: Pending review entry — only visible to admin when N>0 */}
      <div className="px-4 mt-5">
        <PendingReviewRow count={3} />
      </div>

      <div className="px-6 mt-5">
        <InviteCodePanel />
      </div>

      <div className="px-6 mt-6">
        <h3 className="text-h2 text-foreground mb-3">Members ({MEMBERS.length} / 10)</h3>
        <div className="space-y-2.5">
          {MEMBERS.map((m) => (
            <div key={m.name} className="flex items-center gap-3 py-1.5">
              <Avatar name={m.name} src={m.src} size={40} />
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-body font-bold text-foreground truncate">
                  {m.name}
                  {m.you && <span className="text-muted-foreground font-medium"> (you)</span>}
                </span>
                {m.admin && <AdminBadge />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 mt-8 pb-8 space-y-1">
        <button className="w-full h-12 text-body font-semibold text-accent">Transfer admin</button>
        <button className="w-full h-12 text-body font-bold text-destructive">Delete group</button>
      </div>
    </div>
  );
}

/* ============ PHASE 3 INVENTORY ============ */
export function Phase3InventoryScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto px-5 py-6 space-y-7">
      <div>
        <h1 className="text-h1 text-foreground">Phase 3 · Inventory</h1>
        <p className="mt-1 text-body text-muted-foreground font-medium">
          Tab bar · status pills · group card states · queue badge
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Status pill
        </h2>
        <div className="flex flex-wrap gap-2 items-center">
          <StatusPill status="none" />
          <StatusPill status="pending" />
          <StatusPill status="approved" />
          <StatusPill status="rejected" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Type chip
        </h2>
        <div className="flex gap-2">
          <TypeChip kind="photo" />
          <TypeChip kind="video" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Cutoff hints
        </h2>
        <div className="rounded-md bg-surface border border-border p-3 space-y-2">
          <div><CutoffHint cutoff="9:00 AM" minutesLeft={240} /></div>
          <div><CutoffHint cutoff="9:00 AM" minutesLeft={47} /></div>
          <div><CutoffHint cutoff="9:00 AM" minutesLeft={3} /></div>
          <div><CutoffHint submittedAgo="2m ago" /></div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Group card · all CTA states
        </h2>
        <GroupCard
          name="Default"
          goal="Hasn't submitted yet"
          kind="photo"
          status="none"
          cutoff="9:00 AM"
          minutesLeft={240}
        />
        <GroupCard
          name="Pending"
          goal="Awaiting admin review"
          kind="video"
          status="pending"
          submittedAgo="2m ago"
        />
        <GroupCard
          name="Approved"
          goal="Counted for today"
          kind="photo"
          status="approved"
          submittedAgo="1h ago"
        />
        <GroupCard
          name="Rejected"
          goal="Didn't count today"
          kind="photo"
          status="rejected"
        />
        <GroupCard
          name="With queue"
          goal="Upload still uploading in background"
          kind="video"
          status="pending"
          submittedAgo="just now"
          queued
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Tab bar
        </h2>
        <div className="rounded-md overflow-hidden border border-border">
          <TabBar active="today" />
        </div>
        <div className="rounded-md overflow-hidden border border-border">
          <TabBar active="groups" />
        </div>
        <div className="rounded-md overflow-hidden border border-border">
          <TabBar active="profile" />
        </div>
      </section>
    </div>
  );
}
