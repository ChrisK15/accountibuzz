import { Phone } from "@/mocks/primitives";
import { TokenSheetScreen } from "@/mocks/screens/TokenSheet";
import { InventoryScreen } from "@/mocks/screens/Inventory";
import {
  ForgotPasswordScreen,
  LoginScreen,
  ResetPasswordScreen,
  SignUpScreen,
} from "@/mocks/screens/AuthScreens";
import {
  OnboardingProfileScreen,
  ProfileEditScreen,
  ProfileViewScreen,
} from "@/mocks/screens/ProfileScreens";
import {
  GroupsListEmptyScreen,
  GroupsListPopulatedScreen,
} from "@/mocks/screens/GroupsList";
import { CreateGroupScreen } from "@/mocks/screens/CreateGroup";
import { TimezonePickerScreen } from "@/mocks/screens/TimezonePicker";
import {
  GroupDetailAdminScreen,
  GroupDetailFirstCreateScreen,
  GroupDetailMemberScreen,
} from "@/mocks/screens/GroupDetail";
import {
  InvitePreviewAlreadyMemberScreen,
  InvitePreviewFullScreen,
  InvitePreviewScreen,
  JoinWithCodeErrorExpiredScreen,
  JoinWithCodeErrorNotFoundScreen,
  JoinWithCodeScreen,
  PreAuthInviteScreen,
} from "@/mocks/screens/JoinFlow";
import {
  DeleteGroupScreen,
  LeaveGroupScreen,
  TransferAdminScreen,
} from "@/mocks/screens/GroupModals";
import { SharePreviewScreen } from "@/mocks/screens/SharePreview";
import { Phase2InventoryScreen } from "@/mocks/screens/Phase2Inventory";
import {
  GroupDetailAdminWithPendingScreen,
  Phase3InventoryScreen,
  TodayScreen,
  TodayScreenAllStates,
  TodayScreenEmpty,
} from "@/mocks/screens/Today";
import {
  CameraPermissionDeniedScreen,
  CaptureInventoryScreen,
  CapturePhotoScreen,
  CaptureVideoIdleScreen,
  CaptureVideoRecordingScreen,
  DiscardTakeModalScreen,
  MicPermissionDeniedScreen,
  ReviewErrorScreen,
  ReviewPhotoScreen,
  ReviewSubmittingScreen,
  ReviewVideoScreen,
} from "@/mocks/screens/Capture";
import {
  ReviewFirstTimeTooltipScreen,
  ReviewQueueEmptyScreen,
  ReviewQueueErrorScreen,
  ReviewQueueLoadingScreen,
  ReviewQueueRejectReasonScreen,
  ReviewQueueScreen,
  ReviewQueueSwipingApproveScreen,
  ReviewQueueSwipingRejectScreen,
} from "@/mocks/screens/Review";
import {
  GroupDetailWithSocialEmptyScreen,
  GroupDetailWithSocialScreen,
  LeaderboardExpandedScreen,
  Phase4InventoryScreen,
  TodayScreenWithSocial,
} from "@/mocks/screens/Social";

type Section = {
  id: string;
  title: string;
  subtitle?: string;
  variants: { label: string; node: React.ReactNode }[];
};

const sections: Section[] = [
  {
    id: "tokens",
    title: "01 · Design tokens",
    subtitle: "Color, type, radii, elevation, spacing",
    variants: [
      { label: "Light", node: <TokenSheetScreen /> },
      { label: "Dark", node: <TokenSheetScreen /> },
    ],
  },
  {
    id: "inventory",
    title: "02 · Component inventory",
    subtitle: "Buttons · inputs · avatars",
    variants: [
      { label: "Light", node: <InventoryScreen /> },
      { label: "Dark", node: <InventoryScreen /> },
    ],
  },
  {
    id: "login",
    title: "03 · Login",
    variants: [
      { label: "Light", node: <LoginScreen /> },
      { label: "Dark", node: <LoginScreen /> },
    ],
  },
  {
    id: "signup",
    title: "04 · Sign up",
    variants: [
      { label: "Light", node: <SignUpScreen /> },
      { label: "Dark", node: <SignUpScreen /> },
    ],
  },
  {
    id: "forgot",
    title: "05 · Forgot password",
    variants: [
      { label: "Light", node: <ForgotPasswordScreen /> },
      { label: "Dark", node: <ForgotPasswordScreen /> },
    ],
  },
  {
    id: "reset",
    title: "06 · Reset password",
    variants: [
      { label: "Light", node: <ResetPasswordScreen /> },
      { label: "Dark", node: <ResetPasswordScreen /> },
    ],
  },
  {
    id: "profile-view",
    title: "07a · Profile · view",
    variants: [
      { label: "Light", node: <ProfileViewScreen /> },
      { label: "Dark", node: <ProfileViewScreen /> },
    ],
  },
  {
    id: "profile-edit",
    title: "07b · Profile · edit",
    variants: [
      { label: "Light", node: <ProfileEditScreen /> },
      { label: "Dark", node: <ProfileEditScreen /> },
    ],
  },
  {
    id: "onboarding",
    title: "08 · Onboarding · profile prompt",
    variants: [
      { label: "Light", node: <OnboardingProfileScreen /> },
      { label: "Dark", node: <OnboardingProfileScreen /> },
    ],
  },

  /* ============ PHASE 2 — GROUPS + INVITES ============ */
  {
    id: "p2-inventory",
    title: "P2 · Component inventory",
    subtitle: "Segmented · code input · invite panel · admin badge · chips · type-to-confirm",
    variants: [
      { label: "Light", node: <Phase2InventoryScreen /> },
      { label: "Dark", node: <Phase2InventoryScreen /> },
    ],
  },
  {
    id: "groups-empty",
    title: "09 · Groups list · empty",
    variants: [
      { label: "Light", node: <GroupsListEmptyScreen /> },
      { label: "Dark", node: <GroupsListEmptyScreen /> },
    ],
  },
  {
    id: "groups-populated",
    title: "10 · Groups list · populated",
    variants: [
      { label: "Light", node: <GroupsListPopulatedScreen /> },
      { label: "Dark", node: <GroupsListPopulatedScreen /> },
    ],
  },
  {
    id: "create-group",
    title: "11 · Create group",
    variants: [
      { label: "Light", node: <CreateGroupScreen /> },
      { label: "Dark", node: <CreateGroupScreen /> },
    ],
  },
  {
    id: "timezone",
    title: "12 · Timezone picker",
    variants: [
      { label: "Light", node: <TimezonePickerScreen /> },
      { label: "Dark", node: <TimezonePickerScreen /> },
    ],
  },
  {
    id: "group-admin",
    title: "13a · Group detail · admin",
    variants: [
      { label: "Light", node: <GroupDetailAdminScreen /> },
      { label: "Dark", node: <GroupDetailAdminScreen /> },
    ],
  },
  {
    id: "group-member",
    title: "13b · Group detail · member",
    variants: [
      { label: "Light", node: <GroupDetailMemberScreen /> },
      { label: "Dark", node: <GroupDetailMemberScreen /> },
    ],
  },
  {
    id: "group-first-create",
    title: "14 · Group detail · first-create banner",
    variants: [
      { label: "Light", node: <GroupDetailFirstCreateScreen /> },
      { label: "Dark", node: <GroupDetailFirstCreateScreen /> },
    ],
  },
  {
    id: "join-code",
    title: "15a · Join with code",
    variants: [
      { label: "Light", node: <JoinWithCodeScreen /> },
      { label: "Dark", node: <JoinWithCodeScreen /> },
    ],
  },
  {
    id: "join-not-found",
    title: "15b · Join · code not found",
    variants: [
      { label: "Light", node: <JoinWithCodeErrorNotFoundScreen /> },
      { label: "Dark", node: <JoinWithCodeErrorNotFoundScreen /> },
    ],
  },
  {
    id: "join-expired",
    title: "15c · Join · code expired",
    variants: [
      { label: "Light", node: <JoinWithCodeErrorExpiredScreen /> },
      { label: "Dark", node: <JoinWithCodeErrorExpiredScreen /> },
    ],
  },
  {
    id: "invite-preview",
    title: "16a · Invite preview",
    variants: [
      { label: "Light", node: <InvitePreviewScreen /> },
      { label: "Dark", node: <InvitePreviewScreen /> },
    ],
  },
  {
    id: "invite-full",
    title: "16b · Invite · group full",
    variants: [
      { label: "Light", node: <InvitePreviewFullScreen /> },
      { label: "Dark", node: <InvitePreviewFullScreen /> },
    ],
  },
  {
    id: "invite-member",
    title: "16c · Invite · already a member",
    variants: [
      { label: "Light", node: <InvitePreviewAlreadyMemberScreen /> },
      { label: "Dark", node: <InvitePreviewAlreadyMemberScreen /> },
    ],
  },
  {
    id: "preauth-invite",
    title: "17 · Pre-auth invite landing",
    variants: [
      { label: "Light", node: <PreAuthInviteScreen /> },
      { label: "Dark", node: <PreAuthInviteScreen /> },
    ],
  },
  {
    id: "transfer-admin",
    title: "18 · Transfer admin",
    variants: [
      { label: "Light", node: <TransferAdminScreen /> },
      { label: "Dark", node: <TransferAdminScreen /> },
    ],
  },
  {
    id: "delete-group",
    title: "19 · Delete group · confirm",
    variants: [
      { label: "Light", node: <DeleteGroupScreen /> },
      { label: "Dark", node: <DeleteGroupScreen /> },
    ],
  },
  {
    id: "leave-group",
    title: "20 · Leave group · confirm",
    variants: [
      { label: "Light", node: <LeaveGroupScreen /> },
      { label: "Dark", node: <LeaveGroupScreen /> },
    ],
  },
  {
    id: "share-preview",
    title: "21 · Native share message preview",
    variants: [
      { label: "Light", node: <SharePreviewScreen /> },
      { label: "Dark", node: <SharePreviewScreen /> },
    ],
  },

  /* ============ PHASE 3 — APP SHELL + TODAY ============ */
  {
    id: "p3-inventory",
    title: "P3 · Component inventory",
    subtitle: "Tab bar · status pills · group card · queue badge · cutoff hints",
    variants: [
      { label: "Light", node: <Phase3InventoryScreen /> },
      { label: "Dark", node: <Phase3InventoryScreen /> },
    ],
  },
  {
    id: "today",
    title: "22a · Today · two groups",
    subtitle: "Primary daily surface — one card per group, lands here on app open",
    variants: [
      { label: "Light", node: <TodayScreen /> },
      { label: "Dark", node: <TodayScreen /> },
    ],
  },
  {
    id: "today-states",
    title: "22b · Today · all states",
    subtitle: "Approved · pending · rejected · urgent cutoff · critical cutoff · queued upload",
    variants: [
      { label: "Light", node: <TodayScreenAllStates /> },
      { label: "Dark", node: <TodayScreenAllStates /> },
    ],
  },
  {
    id: "today-empty",
    title: "22c · Today · empty (no groups)",
    variants: [
      { label: "Light", node: <TodayScreenEmpty /> },
      { label: "Dark", node: <TodayScreenEmpty /> },
    ],
  },
  {
    id: "group-admin-pending",
    title: "23 · Group detail · admin with pending review",
    subtitle: "Single inline 'Pending review (N)' row above members — admin-only, hidden when 0",
    variants: [
      { label: "Light", node: <GroupDetailAdminWithPendingScreen /> },
      { label: "Dark", node: <GroupDetailAdminWithPendingScreen /> },
    ],
  },

  /* ============ PHASE 3 — CAPTURE FLOW ============ */
  {
    id: "capture-inventory",
    title: "P3b · Capture · inventory",
    subtitle: "Shutter states · caption input on scrim · submit error copy",
    variants: [
      { label: "Light", node: <CaptureInventoryScreen /> },
      { label: "Dark", node: <CaptureInventoryScreen /> },
    ],
  },
  {
    id: "capture-photo",
    title: "24a · Capture · photo",
    subtitle: "Tap shutter to capture · no flash, grid, or timer",
    variants: [{ label: "Camera", node: <CapturePhotoScreen /> }],
  },
  {
    id: "capture-video-idle",
    title: "24b · Capture · video idle",
    subtitle: "Tap to start · 10 seconds max · no hold-to-record",
    variants: [{ label: "Camera", node: <CaptureVideoIdleScreen /> }],
  },
  {
    id: "capture-video-rec",
    title: "24c · Capture · video recording",
    subtitle: "Yellow progress bar · countdown · shutter morphs to red square",
    variants: [{ label: "Camera", node: <CaptureVideoRecordingScreen /> }],
  },
  {
    id: "review-photo",
    title: "25a · Review · photo",
    subtitle: "Caption + Retake / Submit photo",
    variants: [{ label: "Camera", node: <ReviewPhotoScreen /> }],
  },
  {
    id: "review-video",
    title: "25b · Review · video (looping, muted)",
    variants: [{ label: "Camera", node: <ReviewVideoScreen /> }],
  },
  {
    id: "review-submitting",
    title: "25c · Review · submitting",
    subtitle: "Inline spinner replaces label · button stays full-width yellow",
    variants: [{ label: "Camera", node: <ReviewSubmittingScreen /> }],
  },
  {
    id: "review-error",
    title: "25d · Review · submit error",
    subtitle: "Inline FormError above the button row · CTA reverts to enabled",
    variants: [{ label: "Camera", node: <ReviewErrorScreen /> }],
  },
  {
    id: "discard-take",
    title: "26 · Discard this take? · modal",
    variants: [{ label: "Camera", node: <DiscardTakeModalScreen /> }],
  },
  {
    id: "perm-camera",
    title: "27a · Camera permission denied",
    variants: [
      { label: "Light", node: <CameraPermissionDeniedScreen /> },
      { label: "Dark", node: <CameraPermissionDeniedScreen /> },
    ],
  },
  {
    id: "perm-mic",
    title: "27b · Mic permission denied (video)",
    variants: [
      { label: "Light", node: <MicPermissionDeniedScreen /> },
      { label: "Dark", node: <MicPermissionDeniedScreen /> },
    ],
  },

  /* ============ PHASE 3 — ADMIN REVIEW QUEUE ============ */
  {
    id: "review-queue",
    title: "28a · Review queue · top card",
    subtitle: "Card stack — top + 2 peeking · swipe right approve / left reject · button fallbacks",
    variants: [
      { label: "Light", node: <ReviewQueueScreen /> },
      { label: "Dark", node: <ReviewQueueScreen /> },
    ],
  },
  {
    id: "review-swipe-approve",
    title: "28b · Review · mid-swipe right (approve)",
    subtitle: "Green check overlay grows with drag · commits past ~35% threshold",
    variants: [
      { label: "Light", node: <ReviewQueueSwipingApproveScreen /> },
      { label: "Dark", node: <ReviewQueueSwipingApproveScreen /> },
    ],
  },
  {
    id: "review-swipe-reject",
    title: "28c · Review · mid-swipe left (reject)",
    subtitle: "Red X overlay · past threshold opens reason panel — does NOT commit immediately",
    variants: [
      { label: "Light", node: <ReviewQueueSwipingRejectScreen /> },
      { label: "Dark", node: <ReviewQueueSwipingRejectScreen /> },
    ],
  },
  {
    id: "review-reject-reason",
    title: "29 · Reject reason panel",
    subtitle: "Card pulled 30% off-screen + faded · optional note · friction warning · Never mind / Reject",
    variants: [
      { label: "Light", node: <ReviewQueueRejectReasonScreen /> },
      { label: "Dark", node: <ReviewQueueRejectReasonScreen /> },
    ],
  },
  {
    id: "review-empty",
    title: "30 · Review queue · all caught up",
    variants: [
      { label: "Light", node: <ReviewQueueEmptyScreen /> },
      { label: "Dark", node: <ReviewQueueEmptyScreen /> },
    ],
  },
  {
    id: "review-loading",
    title: "31 · Review queue · loading skeleton",
    subtitle: "Three shimmer cards in stack position · no global spinner",
    variants: [
      { label: "Light", node: <ReviewQueueLoadingScreen /> },
      { label: "Dark", node: <ReviewQueueLoadingScreen /> },
    ],
  },
  {
    id: "review-error",
    title: "32 · Review queue · RPC error",
    subtitle: "Card snaps back · inline error docked below card · auto-hides after 4s",
    variants: [
      { label: "Light", node: <ReviewQueueErrorScreen /> },
      { label: "Dark", node: <ReviewQueueErrorScreen /> },
    ],
  },
  {
    id: "review-tooltip",
    title: "33 · First-review tooltip · one-time",
    subtitle: "Shown once per admin via SecureStore key · only exit is 'Got it'",
    variants: [
      { label: "Light", node: <ReviewFirstTimeTooltipScreen /> },
      { label: "Dark", node: <ReviewFirstTimeTooltipScreen /> },
    ],
  },

  /* ============ PHASE 4 — SOCIAL ============ */
  {
    id: "p4-inventory",
    title: "P4 · Component inventory",
    subtitle: "Social signal · leaderboard · feed item · still-to-post · missed-yesterday",
    variants: [
      { label: "Light", node: <Phase4InventoryScreen /> },
      { label: "Dark", node: <Phase4InventoryScreen /> },
    ],
  },
  {
    id: "today-social",
    title: "34 · Today · with social signal",
    subtitle: "GroupCard extended in place — posted/total · pts · streak below CTA",
    variants: [
      { label: "Light", node: <TodayScreenWithSocial /> },
      { label: "Dark", node: <TodayScreenWithSocial /> },
    ],
  },
  {
    id: "group-social",
    title: "35 · Group detail · with social",
    subtitle: "Leaderboard · today's posts · still to post · missed yesterday — single scroll",
    variants: [
      { label: "Light", node: <GroupDetailWithSocialScreen /> },
      { label: "Dark", node: <GroupDetailWithSocialScreen /> },
    ],
  },
  {
    id: "leaderboard-expanded",
    title: "36 · Leaderboard · expanded inline",
    subtitle: "All 8 members visible · 'Show top 5' header link · no modal",
    variants: [
      { label: "Light", node: <LeaderboardExpandedScreen /> },
      { label: "Dark", node: <LeaderboardExpandedScreen /> },
    ],
  },
  {
    id: "group-social-empty",
    title: "37 · Group detail · empty / sparse",
    subtitle: "Fresh group, no submissions · zero-state callout, dashed empty feed",
    variants: [
      { label: "Light", node: <GroupDetailWithSocialEmptyScreen /> },
      { label: "Dark", node: <GroupDetailWithSocialEmptyScreen /> },
    ],
  },
];

const Index = () => {
  return (
    <main className="min-h-screen bg-[hsl(40_15%_94%)] text-foreground">
      {/* Gallery header */}
      <header className="px-6 md:px-12 pt-10 pb-6 max-w-[1400px] mx-auto">
        <p className="text-caption font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Design reference · React Native (Expo)
        </p>
        <h1 className="mt-2 text-display md:text-[44px] leading-tight font-extrabold tracking-tight">
          accounti<span className="bg-[hsl(51_100%_63%)] text-[hsl(220_18%_10%)] px-2 rounded-md">buzz</span>
        </h1>
        <p className="mt-3 max-w-2xl text-body text-neutral-700">
          A single-scroll gallery of mobile-frame mockups (390 × 844). Each screen is shown in
          light & dark mode using semantic tokens that map cleanly to React Native primitives.
        </p>
      </header>


      {/* Sections */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10 space-y-16">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <div className="mb-5">
              <h2 className="text-h1 font-extrabold">{s.title}</h2>
              {s.subtitle && <p className="text-body text-neutral-600">{s.subtitle}</p>}
            </div>
            <div className="flex flex-wrap gap-8">
              {s.variants.map((v, i) => (
                <figure key={i} className="flex flex-col items-center gap-3">
                  <Phone dark={v.label === "Dark"}>{v.node}</Phone>
                  <figcaption className="text-caption font-semibold text-neutral-700">
                    {v.label} · 390 × 844
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}

        <footer className="pt-8 pb-16 text-caption text-muted-foreground text-center">
          Static visual reference · no auth, persistence, or routing.
        </footer>
      </div>
    </main>
  );
};

export default Index;
