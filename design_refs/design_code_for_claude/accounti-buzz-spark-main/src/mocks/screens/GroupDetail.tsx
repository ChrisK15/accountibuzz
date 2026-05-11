import { Avatar } from "../primitives";
import {
  AdminBadge,
  Camera,
  ChevronLeft,
  Clock,
  InviteCodePanel,
  MetaChip,
  Users,
  X,
} from "../groups/primitives";

const MEMBERS = [
  { name: "Alex Rivera", you: true, admin: true },
  { name: "Maya Chen", you: false, admin: false, src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop" },
  { name: "Sam Patel", you: false, admin: false },
  { name: "Jordan Lee", you: false, admin: false },
];

function HeroBlock() {
  return (
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
  );
}

function MembersList({ admin }: { admin: boolean }) {
  return (
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
              {m.admin && admin && <AdminBadge />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailHeader() {
  return (
    <div className="px-2 pt-1 pb-1 flex items-center">
      <button className="w-10 h-10 rounded-pill flex items-center justify-center text-foreground">
        <ChevronLeft size={24} />
      </button>
      <h2 className="text-h2 text-foreground flex-1 text-center pr-10 truncate">Morning Run Club</h2>
    </div>
  );
}

export function GroupDetailAdminScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <DetailHeader />
      <HeroBlock />
      <div className="px-6 mt-5">
        <InviteCodePanel />
      </div>
      <MembersList admin />
      <div className="px-6 mt-8 pb-8 space-y-1">
        <button className="w-full h-12 text-body font-semibold text-accent">Transfer admin</button>
        <button className="w-full h-12 text-body font-bold text-destructive">Delete group</button>
      </div>
    </div>
  );
}

export function GroupDetailMemberScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <DetailHeader />
      <HeroBlock />
      <MembersList admin={false} />
      <div className="px-6 mt-8 pb-8">
        <button className="w-full h-12 text-body font-bold text-destructive">Leave group</button>
      </div>
    </div>
  );
}

export function GroupDetailFirstCreateScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <DetailHeader />
      <div className="px-4 pt-1 pb-3">
        <div className="rounded-md bg-primary/25 border border-primary/40 px-4 py-3 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-body font-extrabold text-foreground leading-tight">
              Group created — share the code to invite friends.
            </p>
          </div>
          <button className="w-7 h-7 -mr-1 -mt-0.5 rounded-pill flex items-center justify-center text-foreground/70">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <HeroBlock />
      <div className="px-6 mt-5">
        <InviteCodePanel />
      </div>
      <MembersList admin />
      <div className="px-6 mt-8 pb-8 space-y-1">
        <button className="w-full h-12 text-body font-semibold text-accent">Transfer admin</button>
        <button className="w-full h-12 text-body font-bold text-destructive">Delete group</button>
      </div>
    </div>
  );
}
