import type { ComponentProps } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContactUsButtonProps = Omit<ComponentProps<typeof Button>, "children"> & {
  label?: string;
};

export function ContactUsButton({
  className,
  label = "Contact Us",
  size = "lg",
  type = "button",
  ...props
}: ContactUsButtonProps) {
  return (
    <Button
      type={type}
      size={size}
      className={cn(
        "h-10 w-full min-w-0 bg-contact text-xs font-semibold text-white hover:bg-brand",
        className,
      )}
      {...props}
    >
      <MessageCircle data-icon="inline-start" className="size-3.5" />
      {label}
    </Button>
  );
}
