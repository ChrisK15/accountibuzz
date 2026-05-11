import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "../primitives";
import {
  AdminBadge,
  ChevronLeft,
  MetaChip,
  InviteCodePanel,
} from "../groups/primitives";
import { Camera, Clock, Users, ChevronDown, Play } from "lucide-react";
import {
  GroupCard,
  PendingReviewRow,
  TabBar,
  TodayHeader,
} from "./Today";

/* ============ 1 · TODAY WITH SOCIAL ============ */
export function TodayScreenWithSocial() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <TodayHeader />
        <div className="px-4 space-y-4 pb-6">
          <GroupCard
            name="Morning Run Club"
            goal="Run at least 1 mile before 9am"
            kind="photo"
            status="none"
            cutoff="9:00 AM"
            minutesLeft={240}
            social={{ posted: 4, total: 6, points: 11, streak: 3 }}
          />
          <GroupCard
            name="Evening Spanish"
            goal="10s clip of you reading aloud"
            kind="video"
            status="approved"
            submittedAgo="1h ago"
            social={{ posted: 6, total: 6, points: 18, streak: 7 }}
          />
          <GroupCard
            name="Sunset Sketch Club"
            goal="One quick doodle, any subject"
            kind="photo"
            status="none"
            cutoff="9:00 PM"
            minutesLeft={47}
            social={{ posted: 0, total: 5, points: 0, streak: 0 }}
          />
          <GroupCard
            name="Cold Plunge Crew"
            goal="60s in cold water, post the proof"
            kind="video"
            status="pending"
            submittedAgo="2m ago"
            queued
            social={{ posted: 2, total: 8, points: 7, streak: 0 }}
          />
        </div>
      </div>
      <TabBar active="today" />
    </div>
  );
}

/* ============ LEADERBOARD ============ */
export type LeaderEntry = {
  name: string;
  you?: boolean;
  src?: string;
  points: number;
  streak: number;
  joined?: string;
};

const LEADERS_FULL: LeaderEntry[] = [
  { name: "Maya Chen", points: 24, streak: 12, src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", joined: "Apr 3" },
  { name: "Alex Rivera", you: true, points: 18, streak: 7, joined: "Apr 1" },
  { name: "Jordan Lee", points: 14, streak: 3, joined: "Apr 4" },
  { name: "Sam Patel", points: 9, streak: 0, joined: "Apr 5" },
  { name: "Riley Tan", points: 4, streak: 1, joined: "Apr 7" },
  { name: "Tomás García", points: 2, streak: 0, joined: "Apr 9" },
  { name: "Priya Shah", points: 1, streak: 1, joined: "Apr 10" },
  { name: "Devon Kim", points: 0, streak: 0, joined: "Apr 11" },
];

function RankChip({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="w-6 h-6 rounded-pill bg-primary text-primary-foreground text-caption font-bold flex items-center justify-center tabular-nums">
        1
      </span>
    );
  }
  if (rank === 2 || rank === 3) {
    return (
      <span className="w-6 h-6 rounded-pill bg-muted text-foreground text-caption font-bold flex items-center justify-center tabular-nums">
        {rank}
      </span>
    );
  }
  return (
    <span className="w-6 h-6 flex items-center justify-center text-caption font-bold tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}

export function LeaderboardRow({ rank, entry }: { rank: number; entry: LeaderEntry }) {
  const flameMuted = entry.streak === 0;
  return (
    <div className="h-14 px-4 py-2.5 flex items-center gap-3">
      <RankChip rank={rank} />
      <Avatar name={entry.name} src={entry.src} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-body font-bold text-foreground truncate">
          {entry.name}
          {entry.you && <span className="text-muted-foreground font-medium"> (you)</span>}
        </div>
        <div className="text-caption text-muted-foreground flex items-center gap-1">
          <span className={cn(flameMuted && "text-muted-foreground")}>
            {flameMuted ? "🔥" : "🔥"}
          </span>
          <span className="tabular-nums">{entry.streak}</span>
          {entry.joined && (
            <>
              <span>·</span>
              <span>joined {entry.joined}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-h2 tabular-nums font-extrabold text-foreground leading-none">
          {entry.points}
        </div>
        <div className="text-caption text-muted-foreground mt-0.5">pts</div>
      </div>
    </div>
  );
}

function LeaderboardSection({
  title = "Leaderboard",
  rows,
  total,
  expanded = false,
  onToggleAll,
}: {
  title?: string;
  rows: LeaderEntry[];
  total: number;
  expanded?: boolean;
  onToggleAll?: ReactNode;
}) {
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center justify-between mb-2 px-2">
        <h2 className="text-h2 text-foreground">{title}</h2>
        {total > 5 && (
          <span className="text-body font-semibold text-accent">
            {expanded ? "Show top 5" : "See all"}
          </span>
        )}
      </div>
      <div className="rounded-md bg-surface border border-border shadow-e1 divide-y divide-border">
        {rows.map((e, i) => (
          <LeaderboardRow key={e.name} rank={i + 1} entry={e} />
        ))}
        {!expanded && total > 5 && (
          <button className="w-full h-12 flex items-center justify-center gap-1 text-body font-semibold text-accent">
            Show all {total} members <ChevronDown size={18} />
          </button>
        )}
      </div>
    </section>
  );
}

/* ============ FEED ITEM ============ */
type FeedItemProps = {
  name: string;
  you?: boolean;
  src?: string;
  kind: "photo" | "video";
  caption?: string;
  ago: string;
  thumbUrl?: string;
};

export function FeedItem({ name, you, src, kind, caption, ago, thumbUrl }: FeedItemProps) {
  return (
    <div className="rounded-md bg-surface border border-border shadow-e1 p-3 flex items-start gap-3">
      <Avatar name={name} src={src} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body font-bold text-foreground truncate">
            {name}
            {you && <span className="text-muted-foreground font-medium"> (you)</span>}
          </span>
        </div>
        <div className="text-caption text-muted-foreground">{ago}</div>
        {caption && (
          <p className="mt-1 text-body text-foreground line-clamp-2">{caption}</p>
        )}
      </div>
      <div className="relative w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-border" />
        )}
        {kind === "video" && (
          <span className="absolute bottom-1 right-1 w-5 h-5 rounded-pill bg-foreground/70 flex items-center justify-center">
            <Play size={10} className="text-background fill-background ml-0.5" />
          </span>
        )}
      </div>
    </div>
  );
}

function TodaysPostsSection({ posts }: { posts: FeedItemProps[] }) {
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center mb-3 px-2">
        <h2 className="text-h2 text-foreground">
          Today's posts <span className="text-muted-foreground">({posts.length})</span>
        </h2>
      </div>
      <div className="space-y-3">
        {posts.map((p, i) => (
          <FeedItem key={i} {...p} />
        ))}
      </div>
    </section>
  );
}

function TodaysPostsEmpty({ dashed = false }: { dashed?: boolean }) {
  return (
    <section className="px-4 mt-6">
      <div className="flex items-center mb-3 px-2">
        <h2 className="text-h2 text-foreground">Today's posts <span className="text-muted-foreground">(0)</span></h2>
      </div>
      <div
        className={cn(
          "rounded-md bg-surface p-5 text-center text-body text-muted-foreground",
          dashed ? "border border-dashed border-border" : "border border-border shadow-e1",
        )}
      >
        No posts yet today · <span className="text-foreground font-semibold">be the first to log proof</span>
      </div>
    </section>
  );
}

/* ============ STILL TO POST ============ */
type StillEntry = { name: string; src?: string };

export function StillToPostRow({
  members,
  cutoff,
}: {
  members: StillEntry[];
  cutoff?: string;
}) {
  const visible = members.slice(0, 5);
  const overflow = members.length - visible.length;
  const namesShort =
    members.length === 0
      ? "everyone's in"
      : members.length <= 3
      ? members.map((m) => m.name.split(" ")[0]).join(" · ")
      : members
          .slice(0, 2)
          .map((m) => m.name.split(" ")[0])
          .join(" · ") + ` · ${members.length - 2} more`;
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {visible.map((m) => (
          <div key={m.name} className="ring-2 ring-surface rounded-pill">
            <Avatar name={m.name} src={m.src} size={32} />
          </div>
        ))}
        {overflow > 0 && (
          <span className="ring-2 ring-surface w-8 h-8 rounded-pill bg-muted text-foreground text-caption font-bold flex items-center justify-center tabular-nums">
            +{overflow}
          </span>
        )}
      </div>
      <span className="flex-1 text-body font-medium text-muted-foreground truncate">
        {namesShort}
      </span>
      {cutoff && (
        <span className="inline-flex items-center gap-1 text-caption text-muted-foreground shrink-0">
          <Clock size={12} />
          {cutoff} cutoff
        </span>
      )}
    </div>
  );
}

function StillToPostSection({
  members,
  cutoff,
  totalLabel,
}: {
  members: StillEntry[];
  cutoff?: string;
  totalLabel?: string;
}) {
  return (
    <section className="px-6 mt-7">
      <h3 className="text-caption font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {totalLabel ?? "Still to post"}
      </h3>
      <StillToPostRow members={members} cutoff={cutoff} />
    </section>
  );
}

/* ============ MISSED YESTERDAY ============ */
export function MissedYesterdayTombstone({ members }: { members: StillEntry[] }) {
  if (members.length === 0) return null;
  return (
    <section className="px-6 mt-7">
      <h3 className="text-caption font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Missed yesterday
      </h3>
      <div className="rounded-md bg-muted/40 p-3 flex flex-wrap gap-x-3 gap-y-2 items-center">
        {members.map((m, i) => (
          <span key={m.name} className="inline-flex items-center gap-1.5">
            <span className="opacity-70 grayscale-[.5]">
              <Avatar name={m.name} src={m.src} size={28} />
            </span>
            <span className="text-body font-medium text-muted-foreground">{m.name}</span>
            {i < members.length - 1 && (
              <span className="text-muted-foreground ml-2">·</span>
            )}
          </span>
        ))}
      </div>
      <p className="mt-2 text-caption text-muted-foreground">
        Streaks reset at 12:00 AM PT.
      </p>
    </section>
  );
}

/* ============ GROUP DETAIL HEADER ============ */
function GroupDetailHeader() {
  return (
    <>
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
          <MetaChip icon={<Users size={14} />}>6 / 10 members</MetaChip>
        </div>
      </div>
    </>
  );
}

function MembersRoster({ entries }: { entries: LeaderEntry[] }) {
  return (
    <section className="px-6 mt-7">
      <h3 className="text-h2 text-foreground mb-3">Members ({entries.length} / 10)</h3>
      <div className="space-y-2.5">
        {entries.map((m) => (
          <div key={m.name} className="flex items-center gap-3 py-1.5">
            <Avatar name={m.name} src={m.src} size={40} />
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-body font-bold text-foreground truncate">
                {m.name}
                {m.you && <span className="text-muted-foreground font-medium"> (you)</span>}
              </span>
              {m.you && <AdminBadge />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminFooter() {
  return (
    <div className="px-6 mt-8 pb-8 space-y-1">
      <button className="w-full h-12 text-body font-semibold text-accent">Transfer admin</button>
      <button className="w-full h-12 text-body font-bold text-destructive">Delete group</button>
    </div>
  );
}

/* ============ 2 · GROUP DETAIL WITH SOCIAL ============ */
const TODAYS_POSTS: FeedItemProps[] = [
  {
    name: "Jordan Lee",
    kind: "photo",
    caption: "morning run, 3 miles",
    ago: "3m ago",
    thumbUrl: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&h=200&fit=crop",
  },
  {
    name: "Maya Chen",
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    kind: "video",
    ago: "27m ago",
    thumbUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=200&h=200&fit=crop",
  },
  {
    name: "Alex Rivera",
    you: true,
    kind: "photo",
    caption: "3 chapters down",
    ago: "1h ago",
    thumbUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop",
  },
];

const STILL_TO_POST: StillEntry[] = [
  { name: "Sam Patel" },
  { name: "Riley Tan" },
  { name: "Tomás García" },
];

const MISSED_YESTERDAY: StillEntry[] = [
  { name: "Sam Patel" },
  { name: "Riley Tan" },
];

export function GroupDetailWithSocialScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <GroupDetailHeader />

      <LeaderboardSection rows={LEADERS_FULL.slice(0, 5)} total={8} />
      <TodaysPostsSection posts={TODAYS_POSTS} />
      <StillToPostSection members={STILL_TO_POST} cutoff="9:00 PM" />
      <MissedYesterdayTombstone members={MISSED_YESTERDAY} />

      <MembersRoster entries={LEADERS_FULL.slice(0, 6)} />

      <div className="px-4 mt-5">
        <PendingReviewRow count={3} />
      </div>

      <div className="px-6 mt-5">
        <InviteCodePanel />
      </div>

      <AdminFooter />
    </div>
  );
}

/* ============ 3 · LEADERBOARD EXPANDED ============ */
export function LeaderboardExpandedScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <GroupDetailHeader />

      <LeaderboardSection rows={LEADERS_FULL} total={8} expanded />
      <TodaysPostsSection posts={TODAYS_POSTS} />
      <StillToPostSection members={STILL_TO_POST} cutoff="9:00 PM" />
      <MissedYesterdayTombstone members={MISSED_YESTERDAY} />

      <MembersRoster entries={LEADERS_FULL} />

      <AdminFooter />
    </div>
  );
}

/* ============ 4 · EMPTY / SPARSE ============ */
const EMPTY_LEADERS: LeaderEntry[] = [
  { name: "Alex Rivera", you: true, points: 0, streak: 0 },
  { name: "Devon Kim", points: 0, streak: 0 },
  { name: "Jordan Lee", points: 0, streak: 0 },
  { name: "Maya Chen", points: 0, streak: 0, src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop" },
  { name: "Priya Shah", points: 0, streak: 0 },
  { name: "Riley Tan", points: 0, streak: 0 },
  { name: "Sam Patel", points: 0, streak: 0 },
  { name: "Tomás García", points: 0, streak: 0 },
];

export function GroupDetailWithSocialEmptyScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <GroupDetailHeader />

      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-2 px-2">
          <h2 className="text-h2 text-foreground">Leaderboard</h2>
        </div>
        <div className="rounded-md bg-muted/40 p-3 mb-2 text-body font-medium text-muted-foreground text-center">
          Nobody's on the board yet — submit today to start the streak.
        </div>
        <div className="rounded-md bg-surface border border-border shadow-e1 divide-y divide-border">
          {EMPTY_LEADERS.slice(0, 5).map((e) => (
            <div key={e.name} className="h-14 px-4 py-2.5 flex items-center gap-3">
              <span className="w-6" />
              <Avatar name={e.name} src={e.src} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-body font-bold text-foreground truncate">
                  {e.name}
                  {e.you && <span className="text-muted-foreground font-medium"> (you)</span>}
                </div>
                <div className="text-caption text-muted-foreground flex items-center gap-1">
                  🔥 <span className="tabular-nums">0</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-h2 tabular-nums font-extrabold text-muted-foreground leading-none">0</div>
                <div className="text-caption text-muted-foreground mt-0.5">pts</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <TodaysPostsEmpty dashed />

      <StillToPostSection
        members={EMPTY_LEADERS}
        cutoff="9:00 PM"
        totalLabel={`${EMPTY_LEADERS.length} member · 8 still to post`}
      />

      <MembersRoster entries={EMPTY_LEADERS} />

      <AdminFooter />
    </div>
  );
}

/* ============ 5 · PHASE 4 INVENTORY ============ */
export function Phase4InventoryScreen() {
  const oneMisser: StillEntry[] = [{ name: "Sam Patel" }];
  const threeMissers: StillEntry[] = [
    { name: "Sam Patel" },
    { name: "Riley Tan" },
    { name: "Jordan Lee" },
  ];
  const eightMissers: StillEntry[] = EMPTY_LEADERS;

  return (
    <div className="h-full bg-background overflow-y-auto px-5 py-6 space-y-7">
      <div>
        <h1 className="text-h1 text-foreground">Phase 4 · Inventory</h1>
        <p className="mt-1 text-body text-muted-foreground font-medium">
          Social signal · leaderboard · feed · still-to-post · missed-yesterday
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Social signal line
        </h2>
        <p className="text-body font-medium text-muted-foreground">
          Card divider with posted · pts · streak. Includes "be the first" + queued + zero-streak.
        </p>
        <GroupCard
          name="Morning Run Club"
          goal="Run a mile before 9am"
          kind="photo"
          status="none"
          cutoff="9:00 AM"
          minutesLeft={240}
          social={{ posted: 4, total: 6, points: 11, streak: 3 }}
        />
        <GroupCard
          name="Evening Spanish"
          goal="10s clip reading aloud"
          kind="video"
          status="approved"
          submittedAgo="1h ago"
          social={{ posted: 6, total: 6, points: 18, streak: 7 }}
        />
        <GroupCard
          name="Sunset Sketch Club"
          goal="One quick doodle"
          kind="photo"
          status="none"
          cutoff="9:00 PM"
          minutesLeft={47}
          social={{ posted: 0, total: 5, points: 0, streak: 0 }}
        />
        <GroupCard
          name="Cold Plunge Crew"
          goal="60s in cold water"
          kind="video"
          status="pending"
          submittedAgo="2m ago"
          queued
          social={{ posted: 2, total: 8, points: 7, streak: 0 }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Leaderboard rows
        </h2>
        <p className="text-body font-medium text-muted-foreground">
          All 8 ranks (1 = primary chip, 2/3 = muted chip, 4+ = bold tabular).
        </p>
        <div className="rounded-md bg-surface border border-border shadow-e1 divide-y divide-border">
          {LEADERS_FULL.map((e, i) => (
            <LeaderboardRow key={e.name} rank={i + 1} entry={e} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Feed items
        </h2>
        <p className="text-body font-medium text-muted-foreground">
          Photo + video + with-caption + no-caption.
        </p>
        <div className="space-y-3">
          {TODAYS_POSTS.map((p, i) => (
            <FeedItem key={i} {...p} />
          ))}
          <FeedItem
            name="Riley Tan"
            kind="video"
            ago="just now"
            thumbUrl="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Still to post
        </h2>
        <p className="text-body font-medium text-muted-foreground">
          1 misser · 3 missers · 8 missers (overflow chip).
        </p>
        <div className="space-y-3">
          <StillToPostRow members={oneMisser} cutoff="9:00 AM" />
          <StillToPostRow members={threeMissers} cutoff="9:00 AM" />
          <StillToPostRow members={eightMissers} cutoff="9:00 PM" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Missed yesterday tombstone
        </h2>
        <p className="text-body font-medium text-muted-foreground">
          Quiet bg-muted/40 chips · never red · never alarmist.
        </p>
        <div className="rounded-md bg-muted/40 p-3 text-caption text-muted-foreground">
          — no tombstones (0-count renders nothing in production)
        </div>
        <MissedYesterdayTombstone members={MISSED_YESTERDAY} />
        <MissedYesterdayTombstone
          members={[
            { name: "Sam Patel" },
            { name: "Riley Tan" },
            { name: "Jordan Lee" },
            { name: "Tomás García" },
            { name: "Devon Kim" },
          ]}
        />
      </section>
    </div>
  );
}
