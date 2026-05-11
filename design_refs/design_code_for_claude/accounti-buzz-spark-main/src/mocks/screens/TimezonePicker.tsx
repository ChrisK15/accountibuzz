import { Check, Search } from "../groups/primitives";

const ZONES = [
  { label: "Pacific Time", iana: "America/Los_Angeles", selected: true },
  { label: "Mountain Time", iana: "America/Denver" },
  { label: "Central Time", iana: "America/Chicago" },
  { label: "Eastern Time", iana: "America/New_York" },
  { label: "Atlantic Time", iana: "America/Halifax" },
  { label: "Greenwich Mean Time", iana: "Europe/London" },
  { label: "Central European Time", iana: "Europe/Berlin" },
  { label: "Eastern European Time", iana: "Europe/Athens" },
  { label: "India Standard Time", iana: "Asia/Kolkata" },
  { label: "Japan Standard Time", iana: "Asia/Tokyo" },
];

export function TimezonePickerScreen() {
  return (
    <div className="h-full bg-background flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button className="text-body font-bold text-accent">Cancel</button>
        <h2 className="text-h2 text-foreground">Choose timezone</h2>
        <div className="w-14" />
      </div>

      <div className="px-4 pb-2">
        <div className="h-12 rounded-md bg-muted px-3 flex items-center gap-2">
          <Search size={18} className="text-muted-foreground" />
          <input
            readOnly
            placeholder="Search regions or cities"
            className="flex-1 bg-transparent outline-none text-body text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {ZONES.map((z) => (
          <button
            key={z.iana}
            className="w-full text-left px-3 py-3 rounded-md flex items-center gap-3 active:bg-muted/60"
          >
            <div className="flex-1 min-w-0">
              <div className="text-body font-bold text-foreground">{z.label}</div>
              <div className="text-caption text-muted-foreground truncate">{z.iana}</div>
            </div>
            {z.selected && (
              <span className="w-7 h-7 rounded-pill bg-primary inline-flex items-center justify-center">
                <Check size={16} className="text-primary-foreground" strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
