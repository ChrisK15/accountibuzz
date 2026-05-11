import { Avatar, CTA, Field } from "../primitives";
import { Search, SheetShell } from "../groups/primitives";

const PEOPLE = [
  { name: "Maya Chen", src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", selected: true },
  { name: "Sam Patel" },
  { name: "Jordan Lee" },
];

export function TransferAdminScreen() {
  return (
    <SheetShell title="Transfer admin">
      <div className="px-6 pb-3">
        <p className="text-body text-muted-foreground">
          Pick who'll take over. You'll stay a member.
        </p>
      </div>
      <div className="px-4 pb-2">
        <div className="h-12 rounded-md bg-muted px-3 flex items-center gap-2">
          <Search size={18} className="text-muted-foreground" />
          <input
            readOnly
            placeholder="Search members"
            className="flex-1 bg-transparent outline-none text-body text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {PEOPLE.map((p) => (
          <button
            key={p.name}
            className="w-full text-left px-3 py-2.5 rounded-md flex items-center gap-3 active:bg-muted/60"
          >
            <Avatar name={p.name} src={p.src} size={40} />
            <span className="flex-1 text-body font-bold text-foreground">{p.name}</span>
            <span
              className={
                "w-6 h-6 rounded-pill border-2 flex items-center justify-center " +
                (p.selected ? "border-accent" : "border-input")
              }
            >
              {p.selected && <span className="w-3 h-3 rounded-pill bg-accent" />}
            </span>
          </button>
        ))}
      </div>
      <div className="px-6 pt-2 pb-6 space-y-3">
        <CTA variant="primary">Transfer to Maya Chen</CTA>
      </div>
    </SheetShell>
  );
}

/* ============ DELETE GROUP MODAL ============ */
export function DeleteGroupScreen() {
  return (
    <div className="h-full bg-background/70 flex flex-col justify-end">
      <div className="rounded-t-[28px] bg-surface shadow-e2 p-6 pb-8 space-y-5">
        <div className="w-10 h-1.5 rounded-pill bg-neutral-low mx-auto" />
        <div>
          <h2 className="text-h1 text-foreground">Delete this group?</h2>
          <p className="mt-2 text-body text-muted-foreground">
            This will remove <span className="text-foreground font-bold">Morning Run Club</span> for everyone, along with all submissions and history. This can't be undone.
          </p>
        </div>
        <Field
          label="Type the group name to confirm"
          value="Morning Run"
          placeholder="Morning Run Club"
          state="focused"
          helper="Doesn't quite match yet."
        />
        <div className="space-y-2 pt-2">
          <button className="w-full h-13 min-h-[52px] rounded-md bg-destructive text-destructive-foreground font-bold text-body">
            Delete group
          </button>
          <button className="w-full h-12 text-body font-semibold text-muted-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ LEAVE GROUP MODAL ============ */
export function LeaveGroupScreen() {
  return (
    <div className="h-full bg-background/70 flex flex-col justify-end">
      <div className="rounded-t-[28px] bg-surface shadow-e2 p-6 pb-8 space-y-5">
        <div className="w-10 h-1.5 rounded-pill bg-neutral-low mx-auto" />
        <div>
          <h2 className="text-h1 text-foreground">Leave Morning Run Club?</h2>
          <p className="mt-2 text-body text-muted-foreground">
            Your past submissions stay in the group. You'll lose access to the group and the leaderboard.
          </p>
        </div>
        <div className="space-y-2 pt-2">
          <button className="w-full h-12 text-body font-bold text-destructive">
            Leave group
          </button>
          <button className="w-full h-12 text-body font-semibold text-muted-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
