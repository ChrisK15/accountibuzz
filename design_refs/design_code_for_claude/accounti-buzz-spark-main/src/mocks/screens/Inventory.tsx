import { Avatar, CTA, Field } from "../primitives";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function InventoryScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="px-5 pt-2 pb-8 space-y-5">
        <div>
          <h1 className="text-h1 text-foreground">Components</h1>
          <p className="text-caption text-muted-foreground">All variants · default · pressed · loading</p>
        </div>

        <Row label="Button · primary">
          <CTA variant="primary">Log in</CTA>
          <CTA variant="primary" pressed>Log in (pressed)</CTA>
          <CTA variant="primary" loading />
        </Row>

        <Row label="Button · secondary">
          <CTA variant="secondary">Cancel</CTA>
          <CTA variant="secondary" pressed>Cancel (pressed)</CTA>
        </Row>

        <Row label="Button · ghost">
          <CTA variant="ghost">Skip for now</CTA>
        </Row>

        <Row label="Button · destructive">
          <CTA variant="destructive">Delete account</CTA>
        </Row>

        <Row label="Text input · states">
          <Field label="Default" value="" placeholder="you@email.com" />
          <Field label="Focused" value="alex@friends" state="focused" />
          <Field label="Error" value="alex@friends" state="error" helper="Enter a valid email address." />
          <Field label="Disabled" value="alex@friends.app" state="disabled" />
        </Row>

        <Row label="Avatar">
          <div className="flex items-center gap-3">
            <Avatar
              name="Maya"
              size={56}
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop"
            />
            <Avatar name="Alex Rivera" size={56} />
            <Avatar name="Sam Chen" size={56} />
            <Avatar name="Jordan Lee" size={56} />
          </div>
          <div className="text-caption text-muted-foreground">image · initials (deterministic from name hash)</div>
        </Row>
      </div>
    </div>
  );
}
