import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "staff";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "admin" | "staff";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "admin" | "staff";
  }
}
