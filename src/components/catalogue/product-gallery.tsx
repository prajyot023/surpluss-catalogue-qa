"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { ShareProductButton } from "@/components/catalogue/share-product-button";
import { cn } from "@/lib/utils";

/** Image slider with a seamless infinite loop: arrows and thumbnails on
 * desktop; swipe, a floating thumbnail rail, share and fullscreen buttons on
 * mobile. Full-bleed on phones. */
export function ProductGallery({
  images,
  name,
  productId,
}: {
  images: string[];
  name: string;
  productId?: string;
}) {
  const count = images.length;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, active: count > 1 });
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxRef, lightboxApi] = useEmblaCarousel({
    loop: count > 1,
    active: count > 1,
  });
  const [lightboxActive, setLightboxActive] = useState(0);

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

  const onLightboxSelect = useCallback(() => {
    if (lightboxApi) setLightboxActive(lightboxApi.selectedScrollSnap());
  }, [lightboxApi]);

  useEffect(() => {
    if (!lightboxApi) return;
    lightboxApi.on("select", onLightboxSelect);
    return () => {
      lightboxApi.off("select", onLightboxSelect);
    };
  }, [lightboxApi, onLightboxSelect]);

  // While the fullscreen view is open: start on the current photo, lock page
  // scroll behind it and close on Escape.
  useEffect(() => {
    if (!lightboxOpen) return;
    lightboxApi?.scrollTo(active, true);
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, lightboxApi, active]);

  function openLightbox() {
    setLightboxActive(active);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    // Keep the page carousel on whichever photo was viewed fullscreen.
    emblaApi?.scrollTo(lightboxActive, true);
  }

  if (count === 0) {
    return (
      <div className="relative -mx-4 aspect-square bg-[#f2f3f5] sm:mx-0 sm:rounded-2xl">
        <div className="grid h-full w-full place-items-center text-sm font-medium text-slate-400">
          No image available
        </div>
        <ShareProductButton
          title={name}
          productId={productId}
          className="absolute right-3 top-3 sm:hidden"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="relative -mx-4 overflow-hidden bg-[#f2f3f5] sm:mx-0 sm:rounded-2xl">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {images.map((url, index) => (
              <div key={url + index} className="relative aspect-square min-w-0 flex-[0_0_100%]">
                <Image
                  src={url}
                  alt={`${name} photo ${index + 1}`}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="pointer-events-none select-none object-cover"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 sm:hidden">
          <ShareProductButton title={name} productId={productId} />
          <button
            type="button"
            aria-label="View photos fullscreen"
            onClick={openLightbox}
            className="focus-ring grid size-9 place-items-center rounded-full bg-white/90 text-brand shadow-md backdrop-blur transition-colors hover:bg-white"
          >
            <Maximize2 className="size-4.5" />
          </button>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => emblaApi?.scrollPrev()}
              className="focus-ring absolute left-3 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand shadow-md backdrop-blur hover:bg-white sm:grid"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => emblaApi?.scrollNext()}
              className="focus-ring absolute right-3 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand shadow-md backdrop-blur sm:grid hover:bg-white"
            >
              <ChevronRight className="size-5" />
            </button>

            {/* Floating rail on phones to jump between photos; thumbnails
                below the image cover this on larger screens. */}
            <div className="absolute left-2.5 top-1/2 z-10 flex max-h-[85%] -translate-y-1/2 flex-col gap-2 overflow-y-auto rounded-xl bg-white/85 p-1.5 shadow-md backdrop-blur scrollbar-none sm:hidden">
              {images.map((url, index) => (
                <button
                  key={url + index}
                  type="button"
                  aria-label={`Show photo ${index + 1}`}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={cn(
                    "relative size-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200",
                    index === active
                      ? "border-brand"
                      : "border-transparent opacity-60",
                  )}
                >
                  <Image src={url} alt="" fill sizes="48px" className="object-cover" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 hidden grid-cols-4 gap-3 sm:grid">
          {images.map((url, index) => (
            <button
              key={url + index}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`Show photo ${index + 1} of ${name}`}
              className={cn(
                "focus-ring relative aspect-square w-full overflow-hidden rounded-lg border-2 bg-[#f2f3f5] transition",
                index === active ? "border-brand" : "border-transparent hover:border-slate-300",
              )}
            >
              <Image src={url} alt="" fill sizes="12vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`${name} photo gallery`}
          >
            <div className="flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
              <span className="text-sm font-medium text-white/80">
                {lightboxActive + 1} / {count}
              </span>
              <button
                type="button"
                aria-label="Close gallery"
                onClick={closeLightbox}
                className="focus-ring grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="size-5" />
              </button>
            </div>

            <div ref={lightboxRef} className="min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full touch-pan-y">
                {images.map((url, index) => (
                  <div key={url + index} className="relative min-w-0 flex-[0_0_100%]">
                    <Image
                      src={url}
                      alt={`${name} photo ${index + 1}`}
                      fill
                      sizes="100vw"
                      className="select-none object-contain"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            </div>

            {count > 1 && (
              <div className="flex gap-2 overflow-x-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] scrollbar-none">
                <div className="mx-auto flex gap-2">
                  {images.map((url, index) => (
                    <button
                      key={url + index}
                      type="button"
                      aria-label={`Show photo ${index + 1}`}
                      onClick={() => lightboxApi?.scrollTo(index)}
                      className={cn(
                        "relative size-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200",
                        index === lightboxActive
                          ? "border-white"
                          : "border-transparent opacity-50",
                      )}
                    >
                      <Image src={url} alt="" fill sizes="48px" className="object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
