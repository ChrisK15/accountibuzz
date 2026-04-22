import { z } from 'zod';

export const emailSchema = z.string().email('Enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[0-9]/, 'Must include a number')
  .regex(/[^A-Za-z0-9]/, 'Must include a symbol');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match. Give it another shot.",
    path: ['confirmPassword'],
  });

export const forgotSchema = z.object({ email: emailSchema });

export const otpSchema = z.object({
  token: z
    .string()
    .regex(/^\d{4,10}$/, 'Enter the numeric code from your email.'),
});

export const resetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
