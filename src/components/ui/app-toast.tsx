"use client";

import { toast } from "sonner";

type ToastTone = "success" | "error" | "info" | "warning";

function show(tone: ToastTone, title: string, description?: string) {
  return toast[tone](title, { description });
}

export const appToast = {
  success: (title: string, description?: string) => show("success", title, description),
  error: (title: string, description?: string) => show("error", title, description),
  info: (title: string, description?: string) => show("info", title, description),
  warning: (title: string, description?: string) => show("warning", title, description),
};
