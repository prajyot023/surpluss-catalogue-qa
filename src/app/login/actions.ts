"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email address and password." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/admin?signedIn=1",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "That email address and password do not match." };
    }
    // next-auth signals a successful redirect by throwing; let it through.
    throw error;
  }
}
