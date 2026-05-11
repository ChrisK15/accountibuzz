import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CTA } from "../primitives";
import {
  X,
  RefreshCw,
  Settings,
  VolumeX,
  Volume2,
  Mic,
  Camera as CameraIcon,
} from "lucide-react";

/* ============ FAUX VIEWFINDER BACKGROUND ============ */
function PhotoViewfinder() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(160deg, hsl(28 35% 55%) 0%, hsl(20 30% 30%) 45%, hsl(220 20% 18%) 100%)",
      }}
    >
      {/* faux subject silhouette */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[34%] w-44 h-44 rounded-full opacity-60"
        style={{ background: "radial-gradient(circle at 35% 30%, hsl(40 50% 70%), hsl(20 30% 22%))" }}
      />
      <div
        className="absolute left-0 right-0 bottom-[30%] h-px opacity-30"
        style={{ background: "hsl(40 30% 80%)" }}
      />
    </div>
  );
}

function VideoViewfinder() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, hsl(220 30% 20%) 0%, hsl(220 25% 14%) 60%, hsl(220 30% 8%) 100%)",
      }}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[28%] w-32 h-32 rounded-full opacity-50"
        style={{ background: "radial-gradient(circle at 40% 35%, hsl(35 60% 70%), hsl(20 30% 18%))" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 opacity-40"
        style={{ background: "linear-gradient(0deg, hsl(220 40% 8%), transparent)" }}
      />
    </div>
  );
}

/* ============ TOP BAR (over viewfinder) ============ */
function CaptureTopBar({
  groupName,
  showFlip = false,
}: {
  groupName: string;
  showFlip?: boolean;
}) {
  return (
    <div className="absolute top-0 inset-x-0 z-10 px-4 pt-3 pb-2 flex items-center justify-between">
      <button className="w-10 h-10 rounded-pill flex items-center justify-center bg-black/45 text-white backdrop-blur-sm">
        <X size={20} strokeWidth={2.5} />
      </button>
      <span className="px-3 py-1 rounded-pill bg-black/45 text-white text-caption font-medium backdrop-blur-sm">
        {groupName}
      </span>
      {showFlip ? (
        <button className="w-10 h-10 rounded-pill flex items-center justify-center bg-black/45 text-white backdrop-blur-sm">
          <RefreshCw size={18} strokeWidth={2.5} />
        </button>
      ) : (
        <span className="w-10" />
      )}
    </div>
  );
}

/* ============ SHUTTER BUTTONS ============ */
function PhotoShutter() {
  return (
    <div className="w-[72px] h-[72px] rounded-pill border-4 border-white flex items-center justify-center">
      <span
        className="block w-[52px] h-[52px] rounded-pill"
        style={{ background: "hsl(51 100% 63%)" }}
      />
    </div>
  );
}

function VideoShutterIdle() {
  return (
    <div className="w-[72px] h-[72px] rounded-pill border-4 border-white flex items-center justify-center">
      <span
        className="block w-[52px] h-[52px] rounded-pill"
        style={{ background: "hsl(51 100% 63%)" }}
      />
    </div>
  );
}

function VideoShutterRecording() {
  return (
    <div className="w-[72px] h-[72px] rounded-pill border-4 border-white flex items-center justify-center bg-destructive">
      <span className="block w-4 h-4 rounded-sm bg-white" />
    </div>
  );
}

/* ============ BOTTOM PANEL WRAPPERS ============ */
function BottomPanel({ children, tall = false }: { children: ReactNode; tall?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-10 px-5 pt-5 pb-8",
        tall ? "min-h-[200px]" : "min-h-[140px]",
      )}
      style={{
        background:
          "linear-gradient(0deg, hsl(220 30% 6% / 0.92) 0%, hsl(220 30% 6% / 0.7) 60%, transparent 100%)",
      }}
    >
      {children}
    </div>
  );
}

/* ============ CAPTURE — PHOTO ============ */
export function CapturePhotoScreen() {
  return (
    <div className="relative h-full bg-black">
      <PhotoViewfinder />
      <CaptureTopBar groupName="Morning runners" />
      <BottomPanel>
        <div className="flex justify-center">
          <PhotoShutter />
        </div>
      </BottomPanel>
    </div>
  );
}

/* ============ CAPTURE — VIDEO IDLE ============ */
export function CaptureVideoIdleScreen() {
  return (
    <div className="relative h-full bg-black">
      <VideoViewfinder />
      <CaptureTopBar groupName="Evening Spanish" showFlip />
      <BottomPanel tall>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-1 rounded-pill bg-white/20" />
          <span
            className="text-white text-caption font-bold"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            0:10
          </span>
        </div>
        <div className="flex justify-center">
          <VideoShutterIdle />
        </div>
        <p className="mt-3 text-center text-caption font-medium text-white/85">
          Tap to start · 10 seconds max
        </p>
      </BottomPanel>
    </div>
  );
}

/* ============ CAPTURE — VIDEO RECORDING ============ */
export function CaptureVideoRecordingScreen() {
  return (
    <div className="relative h-full bg-black">
      <VideoViewfinder />
      <CaptureTopBar groupName="Evening Spanish" showFlip />
      {/* live REC badge top-center */}
      <div className="absolute top-16 inset-x-0 z-10 flex justify-center">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-destructive text-destructive-foreground text-caption font-bold">
          <span className="w-2 h-2 rounded-pill bg-white" />
          REC
        </span>
      </div>
      <BottomPanel tall>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-1 rounded-pill bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-pill"
              style={{ width: "62%", background: "hsl(51 100% 63%)" }}
            />
          </div>
          <span
            className="text-white text-caption font-bold"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            0:04
          </span>
        </div>
        <div className="flex justify-center">
          <VideoShutterRecording />
        </div>
      </BottomPanel>
    </div>
  );
}

/* ============ REVIEW PANEL (shared) ============ */
function ReviewPanel({
  charCount = 0,
  ctaLabel,
  loading = false,
  errorText,
}: {
  charCount?: number;
  ctaLabel: string;
  loading?: boolean;
  errorText?: string;
}) {
  const remaining = 140 - charCount;
  const counterTone = remaining < 5 || charCount === 140 ? "text-destructive" : "text-white/70";
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 px-4 pt-4 pb-8"
      style={{
        background:
          "linear-gradient(0deg, hsl(220 30% 6% / 0.95) 0%, hsl(220 30% 6% / 0.85) 70%, transparent 100%)",
      }}
    >
      {/* caption input */}
      <div className="rounded-md bg-white/10 border border-white/20 px-3 h-12 flex items-center gap-2 backdrop-blur-sm">
        <input
          readOnly
          placeholder="Add a note (optional)"
          className="flex-1 bg-transparent outline-none text-body text-white placeholder:text-white/55"
          value={charCount ? "Smashed it before sunrise" : ""}
        />
        <span
          className={cn("text-caption font-medium", counterTone)}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {charCount}/140
        </span>
      </div>

      {errorText && (
        <p className="mt-2 text-caption font-bold text-destructive bg-destructive/15 rounded-sm px-3 py-2">
          {errorText}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button className="h-13 min-h-[52px] px-6 rounded-md font-bold text-body text-white bg-white/10 border border-white/20">
          Retake
        </button>
        <div className="flex-1">
          <CTA variant="primary" loading={loading}>
            {ctaLabel}
          </CTA>
        </div>
      </div>
    </div>
  );
}

/* ============ REVIEW — PHOTO ============ */
export function ReviewPhotoScreen() {
  return (
    <div className="relative h-full bg-black">
      <PhotoViewfinder />
      <CaptureTopBar groupName="Morning runners" />
      <ReviewPanel charCount={24} ctaLabel="Submit photo" />
    </div>
  );
}

/* ============ REVIEW — VIDEO (muted by default) ============ */
export function ReviewVideoScreen() {
  return (
    <div className="relative h-full bg-black">
      <VideoViewfinder />
      <CaptureTopBar groupName="Evening Spanish" />
      {/* mute indicator */}
      <div className="absolute top-16 right-4 z-10">
        <span className="w-9 h-9 rounded-pill bg-black/55 flex items-center justify-center text-white">
          <VolumeX size={18} />
        </span>
      </div>
      {/* loop hint */}
      <div className="absolute top-16 left-4 z-10">
        <span className="px-2.5 py-1 rounded-pill bg-black/55 text-white text-caption font-medium">
          Looping
        </span>
      </div>
      <ReviewPanel charCount={0} ctaLabel="Submit video" />
    </div>
  );
}

/* ============ REVIEW — SUBMITTING ============ */
export function ReviewSubmittingScreen() {
  return (
    <div className="relative h-full bg-black">
      <PhotoViewfinder />
      <CaptureTopBar groupName="Morning runners" />
      <ReviewPanel charCount={24} ctaLabel="Submit photo" loading />
    </div>
  );
}

/* ============ REVIEW — ERROR ============ */
export function ReviewErrorScreen() {
  return (
    <div className="relative h-full bg-black">
      <PhotoViewfinder />
      <CaptureTopBar groupName="Morning runners" />
      <ReviewPanel
        charCount={24}
        ctaLabel="Submit photo"
        errorText="You already submitted today. Streak's safe — see you tomorrow."
      />
    </div>
  );
}

/* ============ DISCARD MODAL OVERLAY ============ */
export function DiscardTakeModalScreen() {
  return (
    <div className="relative h-full bg-black">
      <PhotoViewfinder />
      <CaptureTopBar groupName="Morning runners" />
      {/* dim viewfinder behind modal */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm z-20" />
      <div className="absolute inset-x-0 bottom-0 z-30 p-4 pb-8">
        <div className="rounded-lg bg-surface shadow-e2 p-5">
          <h2 className="text-h1 text-foreground">Discard this take?</h2>
          <p className="mt-2 text-body font-medium text-muted-foreground">
            You'll lose what you just recorded.
          </p>
          <div className="mt-5 space-y-2">
            <CTA variant="destructive">Discard</CTA>
            <CTA variant="ghost">Keep recording</CTA>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ PERMISSION DENIED — CAMERA ============ */
function PermissionScreen({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="h-full bg-background flex flex-col">
      <div className="px-2 pt-3 flex items-center">
        <button className="w-10 h-10 rounded-pill flex items-center justify-center text-foreground">
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-pill bg-primary/25 flex items-center justify-center text-foreground">
          {icon}
        </div>
        <h1 className="mt-6 text-h1 text-foreground">{title}</h1>
        <p className="mt-2 text-body font-medium text-muted-foreground max-w-[280px]">{body}</p>
      </div>
      <div className="px-5 pb-8 space-y-2">
        <CTA variant="primary">
          <span className="inline-flex items-center gap-2">
            <Settings size={18} />
            Open Settings
          </span>
        </CTA>
        <CTA variant="ghost">Not now</CTA>
      </div>
    </div>
  );
}

export function CameraPermissionDeniedScreen() {
  return (
    <PermissionScreen
      icon={<CameraIcon size={32} strokeWidth={2} />}
      title="We need camera access"
      body="Tap below to grant access in Settings, then come back."
    />
  );
}

export function MicPermissionDeniedScreen() {
  return (
    <PermissionScreen
      icon={<Mic size={32} strokeWidth={2} />}
      title="We need mic access too"
      body="Videos record audio — flip on mic access in Settings to keep going."
    />
  );
}

/* ============ PHASE 3 · CAPTURE INVENTORY ============ */
export function CaptureInventoryScreen() {
  return (
    <div className="h-full bg-background overflow-y-auto px-5 py-6 space-y-7">
      <div>
        <h1 className="text-h1 text-foreground">Capture · inventory</h1>
        <p className="mt-1 text-body font-medium text-muted-foreground">
          Shutter states · capture top bar · review caption input
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Shutter
        </h2>
        <div className="rounded-md bg-[hsl(220_30%_14%)] p-6 flex justify-around items-center">
          <div className="flex flex-col items-center gap-2">
            <PhotoShutter />
            <span className="text-caption text-white/70 font-medium">Photo / idle</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <VideoShutterIdle />
            <span className="text-caption text-white/70 font-medium">Video / idle</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <VideoShutterRecording />
            <span className="text-caption text-white/70 font-medium">Video / rec</span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Caption input on dark scrim
        </h2>
        <div className="rounded-md bg-[hsl(220_30%_14%)] p-4 space-y-3">
          <div className="rounded-md bg-white/10 border border-white/20 px-3 h-12 flex items-center gap-2">
            <input
              readOnly
              placeholder="Add a note (optional)"
              className="flex-1 bg-transparent outline-none text-body text-white placeholder:text-white/55"
            />
            <span className="text-caption text-white/70 font-medium">0/140</span>
          </div>
          <div className="rounded-md bg-white/10 border border-white/20 px-3 h-12 flex items-center gap-2">
            <input
              readOnly
              value="Smashed it before sunrise"
              className="flex-1 bg-transparent outline-none text-body text-white"
            />
            <span className="text-caption text-white/70 font-medium">24/140</span>
          </div>
          <div className="rounded-md bg-white/10 border border-destructive px-3 h-12 flex items-center gap-2">
            <input
              readOnly
              value={"a".repeat(140)}
              className="flex-1 bg-transparent outline-none text-body text-white truncate"
            />
            <span className="text-caption text-destructive font-bold">140/140</span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
          Submit error copy
        </h2>
        <ul className="space-y-2 text-body text-foreground">
          <li className="rounded-sm bg-destructive/10 px-3 py-2 text-destructive font-bold">
            You're not in this group anymore.
          </li>
          <li className="rounded-sm bg-destructive/10 px-3 py-2 text-destructive font-bold">
            This group expects a video, not a photo.
          </li>
          <li className="rounded-sm bg-destructive/10 px-3 py-2 text-destructive font-bold">
            You already submitted today. Streak's safe — see you tomorrow.
          </li>
          <li className="rounded-sm bg-destructive/10 px-3 py-2 text-destructive font-bold">
            Couldn't submit. We'll keep your photo and try again.
          </li>
        </ul>
      </section>
    </div>
  );
}
