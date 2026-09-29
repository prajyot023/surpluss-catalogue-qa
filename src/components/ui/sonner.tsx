"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon, XIcon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      duration={3800}
      gap={10}
      offset={{ top: 20 }}
      mobileOffset={{ top: 12, left: 12, right: 12 }}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
        close: (
          <XIcon className="size-3.5" />
        ),
      }}
      style={
        {
          "--width": "360px",
          "--normal-bg": "#ffffff",
          "--normal-text": "var(--ink)",
          "--normal-border": "#e2e6eb",
          "--border-radius": "10px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast surpluss-toast",
          title: "surpluss-toast-title",
          description: "surpluss-toast-description",
          icon: "surpluss-toast-icon",
          closeButton: "surpluss-toast-close",
          actionButton: "surpluss-toast-action",
          cancelButton: "surpluss-toast-cancel",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
