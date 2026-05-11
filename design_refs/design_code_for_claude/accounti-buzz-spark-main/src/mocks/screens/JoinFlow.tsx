import { Avatar, CTA } from "../primitives";
import { ChevronLeft, CodeInput, Users } from "../groups/primitives";

function JoinHeader({ title }: { title: string }) {
  return (
    <div className="px-2 pt-1 pb-1 flex items-center">
      <button className="w-10 h-10 rounded-pill flex items-center justify-center text-foreground">
        <ChevronLeft size={24} />
      </button>
      <h2 className="text-h2 text-foreground flex-1 text-center pr-10">{title}</h2>
    </div>
  );
}

export function JoinWithCodeScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <JoinHeader title="Join a group" />
      <div className="flex-1 px-6 pt-6">
        <h1 className="text-h1 text-foreground">Join a group</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Enter the 8-character code your friend shared.
        </p>
        <div className="mt-8">
          <CodeInput value="ABCD" state="focused" />
        </div>
      </div>
      <div className="px-6 pb-8 space-y-3">
        <CTA variant="primary">Find group</CTA>
        <p className="text-center text-caption text-muted-foreground">
          No 0/O · 1/I/L — they look too alike.
        </p>
      </div>
    </div>
  );
}

export function JoinWithCodeErrorNotFoundScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <JoinHeader title="Join a group" />
      <div className="flex-1 px-6 pt-6">
        <h1 className="text-h1 text-foreground">Join a group</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Enter the 8-character code your friend shared.
        </p>
        <div className="mt-8">
          <CodeInput value="ZZZZQQQQ" state="error" />
        </div>
        <p className="mt-4 text-center text-caption font-semibold text-destructive">
          We couldn't find that code. Double-check with whoever invited you.
        </p>
      </div>
      <div className="px-6 pb-8">
        <CTA variant="primary">Find group</CTA>
      </div>
    </div>
  );
}

export function JoinWithCodeErrorExpiredScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <JoinHeader title="Join a group" />
      <div className="flex-1 px-6 pt-6">
        <h1 className="text-h1 text-foreground">Join a group</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Enter the 8-character code your friend shared.
        </p>
        <div className="mt-8">
          <CodeInput value="ABCDEF12" state="error" />
        </div>
        <p className="mt-4 text-center text-caption font-semibold text-destructive">
          This code has expired. Ask your friend to send a new one.
        </p>
      </div>
      <div className="px-6 pb-8">
        <CTA variant="primary">Find group</CTA>
      </div>
    </div>
  );
}

/* ============ Invite preview cards ============ */
function InviteCard({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <div
      className={
        "rounded-lg bg-surface border border-border shadow-e1 p-5 " +
        (dimmed ? "opacity-60" : "")
      }
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-md bg-primary/20 flex items-center justify-center">
          <Users size={22} className="text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-h1 text-foreground truncate">Morning Run Club</h3>
          <p className="text-caption text-muted-foreground">4 / 10 members</p>
        </div>
      </div>
      <p className="mt-4 text-body text-foreground">
        Run at least 1 mile before 9am — rain or shine.
      </p>
      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
        <Avatar name="Alex Rivera" size={28} />
        <p className="text-caption text-muted-foreground">
          Invited by <span className="text-foreground font-bold">Alex Rivera</span>
        </p>
      </div>
    </div>
  );
}

export function InvitePreviewScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <JoinHeader title="Invitation" />
      <div className="flex-1 px-6 pt-6">
        <h1 className="text-h1 text-foreground">You've been invited</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Tap join to start checking in with the crew.
        </p>
        <div className="mt-6">
          <InviteCard />
        </div>
      </div>
      <div className="px-6 pb-8">
        <CTA variant="primary">Join group</CTA>
      </div>
    </div>
  );
}

export function InvitePreviewFullScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <JoinHeader title="Invitation" />
      <div className="flex-1 px-6 pt-6">
        <h1 className="text-h1 text-foreground">This group is full</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Ten people already, and that's the cap.
        </p>
        <div className="mt-6">
          <InviteCard dimmed />
        </div>
        <p className="mt-4 text-center text-caption text-muted-foreground px-2">
          Ask the admin to make space, or start your own group.
        </p>
      </div>
      <div className="px-6 pb-8">
        <CTA variant="secondary">Back</CTA>
      </div>
    </div>
  );
}

export function InvitePreviewAlreadyMemberScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <JoinHeader title="Invitation" />
      <div className="flex-1 px-6 pt-6">
        <h1 className="text-h1 text-foreground">You're already in</h1>
        <p className="mt-2 text-body text-muted-foreground">
          You joined this crew already — no need to do it again.
        </p>
        <div className="mt-6">
          <InviteCard />
        </div>
      </div>
      <div className="px-6 pb-8 space-y-3">
        <button className="w-full h-13 min-h-[52px] text-body font-bold text-accent">
          Open group
        </button>
      </div>
    </div>
  );
}

export function PreAuthInviteScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center justify-center">
        <div className="inline-flex items-center gap-1">
          <span className="text-h2 text-foreground tracking-tight">accounti</span>
          <span className="text-h2 text-primary-foreground bg-primary px-1.5 rounded-sm tracking-tight">buzz</span>
        </div>
      </div>
      <div className="flex-1 px-6 pt-4 overflow-y-auto">
        <h1 className="text-h1 text-foreground">You've been invited</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Sign in or sign up to join.
        </p>
        <div className="mt-6">
          <InviteCard />
        </div>
      </div>
      <div className="px-6 pb-8 space-y-3">
        <CTA variant="primary">Create account</CTA>
        <CTA variant="secondary">Log in</CTA>
        <p className="text-center text-caption text-muted-foreground">
          We'll bring you straight into the group after.
        </p>
      </div>
    </div>
  );
}
