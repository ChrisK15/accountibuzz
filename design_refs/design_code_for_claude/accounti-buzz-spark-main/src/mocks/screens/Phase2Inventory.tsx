import { Field } from "../primitives";
import {
  AdminBadge,
  Camera,
  CodeInput,
  InviteCodePanel,
  MetaChip,
  Clock,
  Segmented,
  Users,
  Video,
} from "../groups/primitives";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Phase2InventoryScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="px-5 pt-2 pb-8 space-y-5">
        <div>
          <h1 className="text-h1 text-foreground">Phase 2 components</h1>
          <p className="text-caption text-muted-foreground">Groups + invite patterns</p>
        </div>

        <Row label="Segmented control">
          <Segmented
            value="photo"
            options={[
              { value: "photo", label: "Photo", icon: <Camera size={18} /> },
              { value: "video", label: "Video", icon: <Video size={18} /> },
            ]}
          />
        </Row>

        <Row label="Code-input boxes (4 + 4)">
          <CodeInput value="" />
          <CodeInput value="ABCD" state="focused" />
          <CodeInput value="ZZZZQQQQ" state="error" />
        </Row>

        <Row label="Admin badge + meta chips">
          <div className="flex items-center gap-2">
            <AdminBadge />
            <MetaChip icon={<Camera size={14} />}>Photo</MetaChip>
            <MetaChip icon={<Clock size={14} />}>PT</MetaChip>
            <MetaChip icon={<Users size={14} />}>4 / 10</MetaChip>
          </div>
        </Row>

        <Row label="Invite-code panel">
          <InviteCodePanel />
        </Row>

        <Row label="Type-to-confirm input">
          <Field
            label="Type the group name to confirm"
            value="Morning Run"
            placeholder="Morning Run Club"
            state="focused"
            helper="Doesn't quite match yet."
          />
        </Row>
      </div>
    </div>
  );
}
