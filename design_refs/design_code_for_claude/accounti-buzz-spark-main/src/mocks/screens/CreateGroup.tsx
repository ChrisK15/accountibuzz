import { CTA, Field } from "../primitives";
import { Camera, ChevronRight, Segmented, Video } from "../groups/primitives";

export function CreateGroupScreen() {
  const goal = "Run 1 mile every day before 9am, no matter the weather.";
  return (
    <div className="h-full bg-background flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button className="text-body font-bold text-accent">Cancel</button>
        <h2 className="text-h2 text-foreground">New group</h2>
        <div className="w-14" />
      </div>

      <div className="flex-1 px-6 pt-2 overflow-y-auto space-y-5">
        <Field label="Group name" value="Morning Run Club" placeholder="What's this group called?" state="focused" />

        {/* goal description with counter */}
        <div className="space-y-1.5">
          <label className="block text-caption font-semibold text-neutral-high">Goal description</label>
          <div className="rounded-md border-2 border-input bg-surface px-4 py-3 min-h-[96px]">
            <p className="text-body text-foreground leading-snug">{goal}</p>
          </div>
          <div className="flex justify-between text-caption text-muted-foreground">
            <span>What's the daily commitment?</span>
            <span className="font-semibold tabular-nums">{goal.length}/140</span>
          </div>
        </div>

        {/* segmented */}
        <div className="space-y-1.5">
          <label className="block text-caption font-semibold text-neutral-high">Submission type</label>
          <Segmented
            value="photo"
            options={[
              { value: "photo", label: "Photo", icon: <Camera size={18} /> },
              { value: "video", label: "Video", icon: <Video size={18} /> },
            ]}
          />
          <p className="text-caption text-muted-foreground">
            What everyone posts each day. Can't be changed later.
          </p>
        </div>

        {/* timezone read-only row */}
        <div className="space-y-1.5">
          <label className="block text-caption font-semibold text-neutral-high">Timezone</label>
          <button className="w-full h-13 min-h-[52px] rounded-md border-2 border-input bg-surface px-4 flex items-center gap-2 text-left">
            <div className="flex-1">
              <div className="text-body font-semibold text-foreground">Pacific Time</div>
              <div className="text-caption text-muted-foreground">America/Los_Angeles</div>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </button>
          <p className="text-caption text-muted-foreground">
            Used to set your group's daily cutoff at midnight.
          </p>
        </div>
      </div>

      <div className="px-6 pt-3 pb-6">
        <CTA variant="primary">Create group</CTA>
      </div>
    </div>
  );
}
