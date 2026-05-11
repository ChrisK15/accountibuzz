function Swatch({ name, hex, varName, fg = "text-foreground" }: { name: string; hex: string; varName: string; fg?: string }) {
  return (
    <div className="rounded-md overflow-hidden border border-border bg-surface">
      <div className="h-14 w-full" style={{ background: hex }} />
      <div className={`p-2 ${fg}`}>
        <div className="text-caption font-bold leading-tight">{name}</div>
        <div className="text-[11px] text-muted-foreground font-mono leading-tight">{hex}</div>
        <div className="text-[10px] text-muted-foreground font-mono leading-tight truncate">{varName}</div>
      </div>
    </div>
  );
}

export function TokenSheetScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="px-5 pt-2 pb-6">
        <h1 className="text-h1 text-foreground">Design tokens</h1>
        <p className="text-caption text-muted-foreground">Accountibuzz · v1</p>

        <h2 className="mt-5 mb-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">Brand</h2>
        <div className="grid grid-cols-2 gap-2">
          <Swatch name="Primary" hex="#FFDE42" varName="--primary" />
          <Swatch name="Accent" hex="#53CBF3" varName="--accent" />
        </div>

        <h2 className="mt-5 mb-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">Status</h2>
        <div className="grid grid-cols-3 gap-2">
          <Swatch name="Success" hex="hsl(145 55% 42%)" varName="--success" />
          <Swatch name="Warning" hex="hsl(35 95% 55%)" varName="--warning" />
          <Swatch name="Destructive" hex="hsl(4 78% 56%)" varName="--destructive" />
        </div>

        <h2 className="mt-5 mb-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">Neutrals & surfaces</h2>
        <div className="grid grid-cols-3 gap-2">
          <Swatch name="N-low" hex="hsl(220 14% 92%)" varName="--neutral-low" />
          <Swatch name="N-mid" hex="hsl(220 10% 60%)" varName="--neutral-mid" />
          <Swatch name="N-high" hex="hsl(220 15% 28%)" varName="--neutral-high" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Swatch name="Background" hex="hsl(var(--background))" varName="--background" />
          <Swatch name="Surface" hex="hsl(var(--surface))" varName="--surface" />
        </div>

        <h2 className="mt-5 mb-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">Type · Manrope</h2>
        <div className="rounded-md border border-border bg-surface p-3 space-y-1.5">
          <div><span className="text-display text-foreground">Display 32/800</span></div>
          <div><span className="text-h1 text-foreground">Heading 1 · 24/700</span></div>
          <div><span className="text-h2 text-foreground">Heading 2 · 20/700</span></div>
          <div><span className="text-body text-foreground">Body · 16/500 — friends keep you honest.</span></div>
          <div><span className="text-caption text-muted-foreground">Caption · 13/500 — meta + helper text</span></div>
        </div>

        <h2 className="mt-5 mb-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">Radii</h2>
        <div className="flex items-end gap-2">
          {[
            { n: "sm·6", c: "rounded-sm" },
            { n: "md·12", c: "rounded-md" },
            { n: "lg·20", c: "rounded-lg" },
            { n: "pill", c: "rounded-pill" },
          ].map((r) => (
            <div key={r.n} className="flex flex-col items-center gap-1">
              <div className={`w-14 h-14 bg-primary ${r.c}`} />
              <div className="text-[11px] font-mono text-muted-foreground">{r.n}</div>
            </div>
          ))}
        </div>

        <h2 className="mt-5 mb-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">Elevation</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-surface shadow-e1 p-3 text-center text-caption font-semibold">e1 · subtle</div>
          <div className="rounded-md bg-surface shadow-e2 p-3 text-center text-caption font-semibold">e2 · raised</div>
        </div>

        <h2 className="mt-5 mb-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">Spacing</h2>
        <div className="flex items-end gap-2">
          {[4, 8, 12, 16, 24, 32].map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className="bg-accent rounded-sm" style={{ width: s, height: s }} />
              <div className="text-[11px] font-mono text-muted-foreground">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
