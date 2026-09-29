"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { appToast } from "@/components/ui/app-toast";

export function SignedInToast() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("signedIn") === "1") {
      appToast.success("Signed in successfully", "Welcome back to the Surpluss catalogue portal.");
      router.replace(pathname);
    }
  }, [pathname, router]);

  return null;
}
