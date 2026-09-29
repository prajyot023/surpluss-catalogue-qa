"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { BannerFilter, CatalogueBanner } from "@/lib/schemas/catalogue";
import { promotionNameFromUrl, trackEcommerce } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Storefront promotions: a compact row on desktop and an auto-sliding,
 * draggable carousel on phones. */
export function BannerStrip({
  banners,
  onApply,
}: {
  banners: CatalogueBanner[];
  /** Called with the banner's filter recipe when a buyer taps it. */
  onApply: (filter: BannerFilter | null) => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: banners.length > 1, active: banners.length > 1 },
    banners.length > 1 ? [Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })] : [],
  );
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

  if (banners.length === 0) return null;

  const bannerButton = (banner: CatalogueBanner, index: number, className: string) => (
    <button
      key={banner.imageUrl + index}
      type="button"
      onClick={() => {
        trackEcommerce("select_promotion", {
          promotion_name: promotionNameFromUrl(banner.imageUrl),
          creative_slot: `banner_${index + 1}`,
        });
        onApply(banner.filter);
      }}
      aria-label={`View promotion ${index + 1}`}
      className={cn("focus-ring group block min-w-0 rounded-none sm:rounded-2xl", className)}
    >
      {/* Natural sizing keeps uploaded artwork uncropped. The visual frame
          belongs to the image, not to a differently-shaped outer slot. */}
      <Image
        src={banner.imageUrl}
        alt=""
        width={1600}
        height={640}
        priority={index === 0}
        sizes={
          banners.length === 1
            ? "(max-width: 767px) 100vw, 100vw"
            : banners.length === 2
              ? "(max-width: 767px) 100vw, 50vw"
              : "(max-width: 767px) 100vw, 33vw"
        }
        className="pointer-events-none block h-auto w-full select-none border-0 transition duration-300 sm:rounded-2xl sm:border sm:border-slate-200/80 sm:shadow-sm sm:group-hover:-translate-y-0.5 sm:group-hover:shadow-lg"
        draggable={false}
      />
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-0 pb-3 pt-2 sm:px-6 sm:pb-5 sm:pt-5">
      {/* Desktop: a compact promotion row with every artwork fully visible. */}
      <div
        className={cn(
          "hidden items-start gap-3 md:grid lg:gap-4",
          banners.length === 1 && "grid-cols-1",
          banners.length === 2 && "grid-cols-2",
          banners.length === 3 && "grid-cols-3",
        )}
      >
        {banners.map((banner, index) =>
          bannerButton(banner, index, "w-full rounded-2xl"),
        )}
      </div>

      {/* Phones: auto-sliding loop with dots. */}
      <div className="md:hidden">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {banners.map((banner, index) => (
              <div key={banner.imageUrl + index} className="min-w-0 flex-[0_0_100%]">
                {bannerButton(banner, index, "w-full")}
              </div>
            ))}
          </div>
        </div>
        {banners.length > 1 && (
          <div className="mt-2 flex justify-center gap-1.5">
            {banners.map((banner, index) => (
              <button
                key={banner.imageUrl + index}
                type="button"
                aria-label={`Show promotion ${index + 1}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === active ? "w-6 bg-brand" : "w-1.5 bg-slate-300 hover:bg-slate-400",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
