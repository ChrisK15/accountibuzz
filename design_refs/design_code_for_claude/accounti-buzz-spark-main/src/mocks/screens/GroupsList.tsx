import { CTA } from "../primitives";
import {
  IconBtn,
  MoreVertical,
  Plus,
  RowCard,
  Camera,
  Video,
  AdminBadge,
  Users,
} from "../groups/primitives";

export function GroupsListEmptyScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <div className="px-6 pt-3 pb-2 flex items-center justify-between">
        <h2 className="text-h2 text-foreground">Your groups</h2>
        <div className="w-10" />
      </div>
      <div className="flex-1 px-6 flex flex-col items-center justify-center text-center -mt-6">
        {/* warm empty graphic */}
        <div className="relative w-44 h-44">
          <div className="absolute inset-0 rounded-pill bg-primary/25" />
          <div className="absolute inset-6 rounded-pill bg-accent/25" />
          <div className="absolute inset-12 rounded-pill bg-primary shadow-e1 flex items-center justify-center">
            <Users size={44} className="text-primary-foreground" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="mt-8 text-h1 text-foreground">No groups yet</h1>
        <p className="mt-2 text-body text-muted-foreground max-w-[280px]">
          Start one with friends, or join one with a code.
        </p>
      </div>
      <div className="px-6 pb-8 space-y-3">
        <CTA variant="primary">Create a group</CTA>
        <CTA variant="secondary">Join with code</CTA>
      </div>
    </div>
  );
}

const ROWS = [
  {
    name: "Morning Run Club",
    goal: "Run at least 1 mile before 9am — rain or shine.",
    members: "5 / 10",
    type: "photo" as const,
    admin: true,
  },
  {
    name: "Gym Crew",
    goal: "45+ minute lift, log it on the way out.",
    members: "8 / 10",
    type: "video" as const,
    admin: false,
  },
  {
    name: "30 Days of Sketching",
    goal: "One sketch a day. Doesn't have to be good.",
    members: "4 / 10",
    type: "photo" as const,
    admin: false,
  },
];

export function GroupsListPopulatedScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h2 className="text-h2 text-foreground pl-2">Your groups</h2>
        <div className="flex items-center">
          <IconBtn><Plus size={22} strokeWidth={2.5} /></IconBtn>
          <IconBtn><MoreVertical size={20} /></IconBtn>
        </div>
      </div>

      <div className="flex-1 px-4 pt-2 space-y-3 overflow-y-auto">
        {ROWS.map((r) => (
          <RowCard key={r.name}>
            <div className="w-11 h-11 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
              {r.type === "photo" ? (
                <Camera size={20} className="text-foreground" />
              ) : (
                <Video size={20} className="text-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-body font-extrabold text-foreground truncate">{r.name}</span>
                {r.admin && <AdminBadge />}
              </div>
              <p className="text-caption text-muted-foreground truncate">{r.goal}</p>
              <p className="text-caption text-neutral-high mt-0.5 font-semibold">{r.members} members</p>
            </div>
          </RowCard>
        ))}
      </div>

      {/* fake popover hint of menu — render only on populated to show "Join with code" affordance */}
      <div className="absolute right-4 top-14 rounded-md bg-surface shadow-e2 border border-border py-1.5 w-48 hidden">
        <button className="w-full text-left px-3 py-2 text-body text-foreground hover:bg-muted">Join with code</button>
      </div>
    </div>
  );
}
