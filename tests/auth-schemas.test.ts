import {
  loginSchema,
  signupSchema,
  forgotSchema,
  otpSchema,
  resetSchema,
} from '../src/features/auth/schemas';

describe('auth Zod schemas', () => {
  it('loginSchema rejects invalid email and empty password', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(
      false,
    );
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(
      false,
    );
    expect(
      loginSchema.safeParse({ email: 'a@b.co', password: 'anything' }).success,
    ).toBe(true);
  });
  it('signupSchema enforces password strength + matching confirm', () => {
    const base = {
      email: 'a@b.co',
      password: 'Short1!',
      confirmPassword: 'Short1!',
    };
    expect(
      signupSchema.safeParse({
        ...base,
        password: 'short',
        confirmPassword: 'short',
      }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...base, confirmPassword: 'nope' }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({
        ...base,
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      }).success,
    ).toBe(true);
  });
  it('forgotSchema requires valid email', () => {
    expect(forgotSchema.safeParse({ email: 'nope' }).success).toBe(false);
    expect(forgotSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
  });
  it('otpSchema requires a 6-digit numeric code', () => {
    expect(otpSchema.safeParse({ token: '123456' }).success).toBe(true);
    expect(otpSchema.safeParse({ token: '12345' }).success).toBe(false);
    expect(otpSchema.safeParse({ token: '1234567' }).success).toBe(false);
    expect(otpSchema.safeParse({ token: 'abc123' }).success).toBe(false);
    expect(otpSchema.safeParse({ token: '' }).success).toBe(false);
  });
  it('resetSchema validates new password + match', () => {
    expect(
      resetSchema.safeParse({
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      }).success,
    ).toBe(true);
    expect(
      resetSchema.safeParse({ password: 'StrongP@ss1', confirmPassword: 'x' })
        .success,
    ).toBe(false);
  });
});
