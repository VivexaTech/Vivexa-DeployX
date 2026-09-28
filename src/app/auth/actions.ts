"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { integrations } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/data/settings";
import { getAppOrigin, safeNextPath } from "@/lib/auth/origin";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export type AuthFormState = { error?: string; message?: string } | undefined;

const NOT_CONFIGURED = "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable accounts.";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

async function limited(action: string, max: number): Promise<boolean> {
  const ip = clientIp(await headers());
  return !rateLimit(`auth:${action}:${ip}`, max, 15 * 60 * 1000).ok;
}

export async function signInAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!integrations.supabase()) return { error: NOT_CONFIGURED };
  if (await limited("login", 10)) return { error: "Too many sign-in attempts. Please wait a few minutes." };

  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Enter your password"), next: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return { error: error?.message === "Email not confirmed" ? "Please verify your email before signing in." : "Invalid email or password." };
  }

  const { data: profile } = await supabase.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
  if ((profile as { status: string } | null)?.status === "suspended") {
    await supabase.auth.signOut();
    return { error: "This account has been suspended. Contact support for assistance." };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function signUpAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!integrations.supabase()) return { error: NOT_CONFIGURED };
  const settings = await getPlatformSettings();
  if (!settings.signup_enabled) return { error: "New registrations are currently disabled." };
  if (await limited("register", 5)) return { error: "Too many sign-up attempts. Please wait a few minutes." };

  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter your name").max(80),
      email: emailSchema,
      password: passwordSchema,
      terms: z.literal("on", { message: "You must accept the Terms and Privacy Policy" }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const origin = await getAppOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/dashboard/billing?welcome=1")}`,
    },
  });
  if (error) return { error: error.message };

  if (data.session) redirect("/dashboard/billing?welcome=1");
  return { message: "Check your inbox — we sent a verification link to activate your account." };
}

export async function forgotPasswordAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!integrations.supabase()) return { error: NOT_CONFIGURED };
  if (await limited("forgot", 5)) return { error: "Too many requests. Please wait a few minutes." };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const origin = await getAppOrigin();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });
  return { message: "If an account exists for that email, a password reset link is on its way." };
}

export async function resetPasswordAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!integrations.supabase()) return { error: NOT_CONFIGURED };
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords do not match" })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect("/dashboard?password=updated");
}

export async function signOutAction(): Promise<void> {
  if (integrations.supabase()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
