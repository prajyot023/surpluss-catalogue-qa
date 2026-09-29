// Stand-in for "@/auth" in Vitest. Route handlers and server actions call
// auth(); this version returns whichever user the test picked with signInAs().
//
// Use in a test file with:
//   vi.mock("@/auth", () => import("../helpers/auth-mock"));

export type UserRole = "admin" | "staff";

type Session = {
  user: { id: string; email: string; name: string; role: UserRole };
  expires: string;
} | null;

let current: Session = null;

export function signInAs(role: UserRole) {
  current = {
    user: {
      id: `00000000-0000-4000-8000-00000000000${role === "admin" ? 1 : 2}`,
      email: `${role}@catalogue.test`,
      name: role,
      role,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

export function signOutUser() {
  current = null;
}

export async function auth() {
  return current;
}

export async function signIn() {
  throw new Error("signIn is not used in unit tests");
}

export async function signOut() {}

export const handlers = {};
