import { Avatar } from "../primitives";

export function SharePreviewScreen() {
  return (
    <div className="h-full bg-[hsl(220_14%_8%)] flex flex-col">
      {/* fake iMessage header */}
      <div className="px-4 pt-3 pb-3 flex flex-col items-center border-b border-white/10">
        <Avatar name="Alex Rivera" size={36} />
        <p className="mt-1 text-caption font-bold text-white">Alex Rivera</p>
        <p className="text-[11px] text-white/50">iMessage</p>
      </div>

      <div className="flex-1 px-3 pt-4 space-y-2 overflow-y-auto">
        {/* outgoing bubble */}
        <div className="flex justify-end">
          <div className="max-w-[78%] rounded-[20px] bg-[hsl(197_86%_64%)] text-[hsl(220_18%_10%)] px-3.5 py-2.5 text-[15px] leading-snug shadow-e1">
            <p>
              Join my Accountibuzz group <span className="font-extrabold">Morning Run Club</span>: code{" "}
              <span
                className="font-extrabold"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                ABCD-EF12
              </span>
            </p>
            <p className="mt-1.5 text-[hsl(220_18%_10%)]/85">
              Or open: <span className="underline">accountibuzz://invite/ABCDEF12</span>
            </p>
            <p className="mt-1.5 text-[13px] text-[hsl(220_18%_10%)]/70">
              (Get the app: <span className="underline">apps.accountibuzz.com</span>)
            </p>
          </div>
        </div>

        {/* link preview card under the bubble */}
        <div className="flex justify-end">
          <div className="max-w-[78%] rounded-[16px] overflow-hidden bg-white shadow-e1">
            <div className="h-24 bg-primary flex items-center justify-center">
              <div className="inline-flex items-center gap-1">
                <span className="text-h2 text-[hsl(220_18%_10%)] tracking-tight">accounti</span>
                <span className="text-h2 text-primary-foreground bg-[hsl(220_18%_10%)] px-1.5 rounded-sm tracking-tight">buzz</span>
              </div>
            </div>
            <div className="px-3 py-2">
              <p className="text-caption font-extrabold text-[hsl(220_15%_12%)]">Morning Run Club</p>
              <p className="text-[12px] text-[hsl(220_10%_46%)]">accountibuzz.com</p>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/40 pt-2">Delivered</p>
      </div>

      {/* fake input bar */}
      <div className="px-3 py-2 border-t border-white/10 flex items-center gap-2">
        <div className="flex-1 h-9 rounded-pill bg-white/10 px-3 flex items-center text-[13px] text-white/40">
          iMessage
        </div>
      </div>
    </div>
  );
}
