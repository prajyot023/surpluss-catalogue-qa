import { auth, type UserRole } from "@/auth";

export type Actor = { id: string; email: string; role: UserRole };

/**
 * The signed-in actor, or null. Every admin route and server action starts
 * here — nothing under /admin or /api/admin should run for an anonymous user.
 */
export async function currentActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role ?? "staff",
  };
}

/**
 * Publishing a catalogue and deleting a catalogue are the two actions the
 * sales team must not perform on their own: one exposes pricing to the public
 * internet, the other destroys lead history. Both are admin-only.
 */
export function isAdmin(actor: Actor | null): boolean {
  return actor?.role === "admin";
}
