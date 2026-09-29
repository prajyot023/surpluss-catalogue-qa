import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({
  inverse = false,
  className,
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative block h-10 w-33 shrink-0 overflow-hidden",
        className,
      )}
    >
      <Image
        src={
          inverse ? "/surpluss-logo-white-svg.svg" : "/surpluss-logo-dark-svg.svg"
        }
        alt="Surpluss"
        width={150}
        height={99}
        priority
        className="absolute -top-6.75 h-24.75 w-33 max-w-none"
      />
    </span>
  );
}
