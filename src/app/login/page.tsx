import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

function errorMessageFor(error: string | undefined) {
  if (!error) return undefined;
  if (error === "CredentialsSignin") {
    return "That email address and password do not match.";
  }
  return "Sign-in failed. Please try again.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f8] p-5">
      <div className="w-full max-w-sm">
        <div className="text-center"><BrandMark className="mx-auto" /><h1 className="mt-8 text-2xl font-semibold tracking-tight">Welcome back</h1><p className="mt-2 text-sm text-[#737d8b]">Sign in to the catalogue portal</p></div>
        <LoginForm errorMessage={errorMessageFor(error)} />
      </div>
    </main>
  );
}
