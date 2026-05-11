import { Avatar, CTA, Field, ScreenHeader, TextLink } from "../primitives";

function StatChip({ value, label, tone = "primary" }: { value: string; label: string; tone?: "primary" | "accent" }) {
  const bg = tone === "primary" ? "bg-primary/15" : "bg-accent/15";
  return (
    <div className={`flex-1 rounded-md ${bg} px-3 py-2.5 text-center`}>
      <div className="text-h2 font-extrabold text-foreground">{value}</div>
      <div className="text-caption text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

export function ProfileViewScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ScreenHeader
        title="Profile"
        action={<button className="text-body font-bold text-accent">Edit</button>}
      />
      <div className="flex-1 px-6 pt-4">
        <div className="flex flex-col items-center">
          <Avatar name="Alex Rivera" size={96} ring />
          <h1 className="mt-4 text-h1 text-foreground">Alex Rivera</h1>
          <p className="text-body text-muted-foreground">alex@friends.app</p>
        </div>
        <div className="mt-6 flex gap-3">
          <StatChip value="🔥 12" label="Day streak" tone="primary" />
          <StatChip value="2,340" label="Points" tone="accent" />
        </div>
        <div className="mt-6 rounded-md border border-border bg-surface p-4">
          <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today's goal</div>
          <div className="text-body font-bold text-foreground">Run 3km before sundown</div>
          <div className="mt-2 h-2 rounded-pill bg-neutral-low overflow-hidden">
            <div className="h-full w-2/3 bg-primary rounded-pill" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileEditScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ScreenHeader
        title="Edit profile"
        action={<button className="text-body font-bold text-muted-foreground">Cancel</button>}
      />
      <div className="flex-1 px-6 pt-2 overflow-hidden flex flex-col">
        <div className="flex flex-col items-center">
          <Avatar name="Alex Rivera" size={96} />
          <button className="mt-3 text-body font-bold text-accent">Change avatar</button>
        </div>
        <div className="mt-6 space-y-4">
          <Field label="Display name" value="Alex Rivera" state="focused" />
          <Field label="Email" value="alex@friends.app" state="disabled" helper="Email can't be changed here." />
        </div>
        <div className="mt-auto pb-6 space-y-3">
          <CTA>Save changes</CTA>
          <button className="w-full h-12 text-body font-semibold text-destructive">
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingProfileScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <ScreenHeader title="" />
      <div className="flex-1 px-6 flex flex-col">
        <h1 className="text-display text-foreground leading-tight">Let's set up your profile</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Friends will see this when you check in. You can change it anytime.
        </p>
        <div className="mt-8 flex flex-col items-center">
          <Avatar name="" size={96} />
          <button className="mt-3 text-body font-bold text-accent">Add a photo</button>
        </div>
        <div className="mt-6 space-y-4">
          <Field label="Display name" value="" placeholder="What should we call you?" />
        </div>
        <div className="mt-auto pb-6 space-y-3">
          <CTA>Continue</CTA>
          <button className="w-full h-12 text-body font-semibold text-muted-foreground">
            <TextLink tone="muted">Skip for now</TextLink>
          </button>
        </div>
      </div>
    </div>
  );
}
