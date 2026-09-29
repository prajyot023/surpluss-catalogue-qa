"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact swipeable image slider for product cards, with a seamless infinite
 * loop: drag or use the arrows to change photos, tap to open the product. */
export function CardImageSlider({
  images,
  name,
  onOpen,
  className,
  sizes,
}: {
  images: string[];
  name: string;
  onOpen?: () => void;
  className?: string;
  sizes: string;
}) {
  const count = images.length;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, active: count > 1 });
  const [active, setActive] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setActive(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (count === 0) {
    return (
      <button
        type="button"
        onClick={() => onOpen?.()}
        aria-label={`Open ${name}`}
        className={cn("grid place-items-center text-slate-300", className)}
      >
        <ImageIcon className="size-6" aria-hidden />
        <span className="sr-only">Photo coming soon</span>
      </button>
    );
  }

  return (
    <div className={cn("relative cursor-pointer overflow-hidden", className)}>
      {/* Embla cancels the click when the pointer was dragging, so taps open
          the product and swipes only change the photo. */}
      <div ref={emblaRef} className="h-full overflow-hidden" onClick={() => onOpen?.()}>
        <div className="flex h-full touch-pan-y">
          {images.map((url, index) => (
            <div key={url + index} className="relative h-full min-w-0 flex-[0_0_100%]">
              <Image
                src={url}
                alt={index === 0 ? name : `${name} photo ${index + 1}`}
                fill
                sizes={sizes}
                className="pointer-events-none select-none object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(event) => {
              event.stopPropagation();
              emblaApi?.scrollPrev();
            }}
            className="focus-ring absolute left-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-brand opacity-90 shadow-sm backdrop-blur transition-opacity hover:bg-white"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(event) => {
              event.stopPropagation();
              emblaApi?.scrollNext();
            }}
            className="focus-ring absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-brand opacity-90 shadow-sm backdrop-blur transition-opacity hover:bg-white"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
            {images.map((url, index) => (
              <span
                key={url + index}
                className={cn(
                  "h-1 rounded-full bg-white shadow-sm transition-all",
                  index === active ? "w-3.5" : "w-1 opacity-60",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
