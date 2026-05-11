import { CTA, Field, TextLink, Wordmark } from "../primitives";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-hidden bg-background flex flex-col">
      <div className="flex-1 px-6 pt-2">
        <Wordmark tagline="Daily wins, with friends." />
        {children}
      </div>
    </div>
  );
}

export function LoginScreen() {
  return (
    <AuthShell>
      <h1 className="text-h1 text-foreground mb-1">Welcome back</h1>
      <p className="text-body text-muted-foreground mb-6">Log in to keep your streak alive.</p>
      <div className="space-y-4">
        <Field label="Email" value="alex@friends.app" type="email" />
        <Field label="Password" value="••••••••" type="password" />
        <div className="flex justify-end -mt-1">
          <TextLink>Forgot password?</TextLink>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        <CTA>Log in</CTA>
        <p className="text-center text-body text-muted-foreground">
          New here? <TextLink>Sign up</TextLink>
        </p>
      </div>
    </AuthShell>
  );
}

export function SignUpScreen() {
  return (
    <AuthShell>
      <h1 className="text-h1 text-foreground mb-1">Join the buzz</h1>
      <p className="text-body text-muted-foreground mb-6">Three friends, one daily goal.</p>
      <div className="space-y-4">
        <Field label="Email" value="" placeholder="you@email.com" type="email" />
        <Field label="Password" value="" placeholder="At least 8 characters" type="password" />
        <Field label="Confirm password" value="" placeholder="Repeat password" type="password" />
      </div>
      <div className="mt-6 space-y-3">
        <CTA>Create account</CTA>
        <p className="text-center text-caption text-muted-foreground px-4 leading-snug">
          By continuing you agree to our <span className="text-accent font-semibold">Terms</span> and <span className="text-accent font-semibold">Privacy Policy</span>.
        </p>
        <p className="text-center text-body text-muted-foreground pt-2">
          Already have an account? <TextLink>Log in</TextLink>
        </p>
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordScreen() {
  return (
    <AuthShell>
      <h1 className="text-h1 text-foreground mb-1">Forgot password?</h1>
      <p className="text-body text-muted-foreground mb-6">
        Enter your email and we'll send you a reset link.
      </p>
      <div className="space-y-4">
        <Field
          label="Email"
          value="alex@friends.app"
          type="email"
          state="error"
          helper="We couldn't find an account with that email."
        />
      </div>
      <div className="mt-6 space-y-4">
        <CTA>Send reset link</CTA>
        <p className="text-center text-body text-muted-foreground">
          Remembered it? <TextLink>Back to login</TextLink>
        </p>
      </div>
    </AuthShell>
  );
}

export function ResetPasswordScreen() {
  return (
    <AuthShell>
      <h1 className="text-h1 text-foreground mb-1">Set a new password</h1>
      <p className="text-body text-muted-foreground mb-6">
        Choose something memorable but strong.
      </p>
      <div className="space-y-4">
        <Field
          label="New password"
          value=""
          placeholder="At least 8 characters"
          type="password"
          helper="Use 8+ characters with a number and a symbol."
        />
        <Field label="Confirm new password" value="" placeholder="Repeat password" type="password" />
      </div>
      <div className="mt-6">
        <CTA>Reset password</CTA>
      </div>
    </AuthShell>
  );
}
