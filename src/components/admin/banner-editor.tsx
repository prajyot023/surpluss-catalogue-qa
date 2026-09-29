"use client";

import Image from "next/image";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { BANNER_SORTS, type CatalogueBanner } from "@/lib/schemas/catalogue";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";

const SORT_LABELS: Record<(typeof BANNER_SORTS)[number], string> = {
  featured: "Featured",
  discount: "Highest discount",
  "price-asc": "Price: Low to high",
  "price-desc": "Price: High to low",
};

const DISCOUNT_OPTIONS = [10, 25, 50, 70];

/** Up to 3 promo banners. Each is a wide image plus an optional filter recipe
 * (category, sort, minimum discount) applied when a buyer taps it. */
export function BannerEditor({
  banners,
  onChange,
  categories,
  mode,
}: {
  banners: CatalogueBanner[];
  onChange: (banners: CatalogueBanner[]) => void;
  categories: string[];
  mode: "images" | "actions";
}) {
  const reducedMotion = useReducedMotion();

  function update(index: number, banner: CatalogueBanner) {
    onChange(banners.map((current, i) => (i === index ? banner : current)));
  }

  function updateFilter(index: number, patch: Partial<NonNullable<CatalogueBanner["filter"]>>) {
    const banner = banners[index];
    const filter = { category: null, sort: null, minDiscount: null, ...banner.filter, ...patch };
    const empty = filter.category === null && filter.sort === null && filter.minDiscount === null;
    update(index, { ...banner, filter: empty ? null : filter });
  }

  if (mode === "images") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {banners.map((banner, index) => (
          <motion.div
            key={index}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl border border-slate-200 bg-white p-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Banner {index + 1}</p>
                <p className="text-[11px] text-slate-400">Shown in this order</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove banner ${index + 1}`}
                onClick={() => onChange(banners.filter((_, i) => i !== index))}
                className="text-slate-400 hover:text-red-600"
              >
                <IconTrash />
              </Button>
            </div>
            <PhotoUploader
              images={banner.imageUrl ? [banner.imageUrl] : []}
              onChange={(images) => update(index, { ...banner, imageUrl: images[0] ?? "" })}
              max={1}
              kind="catalogue-banner"
              variant="banner"
              helperText="JPG, PNG or WebP · up to 5 MB · 5:2 works best."
            />
          </motion.div>
        ))}
        {banners.length < 3 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange([...banners, { imageUrl: "", filter: null }])}
            className="min-h-32 border-dashed text-slate-500"
          >
            <IconPlus /> Add another banner ({banners.length} of 3)
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {banners.map((banner, index) => (
        <div key={banner.imageUrl} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="relative aspect-[5/2] w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              <Image src={banner.imageUrl} alt="" fill sizes="112px" className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold">Banner {index + 1}</p>
              <p className="mt-0.5 text-xs text-slate-500">Choose what buyers see when they tap it.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <Label>When tapped, show category</Label>
              <Select
                items={{ [NONE]: "All products", ...Object.fromEntries(categories.map((c) => [c, c])) }}
                value={banner.filter?.category ?? NONE}
                onValueChange={(value) =>
                  value && updateFilter(index, { category: value === NONE ? null : String(value) })
                }
              >
                <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>All products</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sorted by</Label>
              <Select
                items={{ [NONE]: "As is", ...SORT_LABELS }}
                value={banner.filter?.sort ?? NONE}
                onValueChange={(value) =>
                  value &&
                  updateFilter(index, {
                    sort: value === NONE ? null : (String(value) as (typeof BANNER_SORTS)[number]),
                  })
                }
              >
                <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>As is</SelectItem>
                  {BANNER_SORTS.map((sort) => (
                    <SelectItem key={sort} value={sort}>{SORT_LABELS[sort]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Minimum discount</Label>
              <Select
                items={{ [NONE]: "Any", ...Object.fromEntries(DISCOUNT_OPTIONS.map((d) => [String(d), `${d}%+`])) }}
                value={banner.filter?.minDiscount !== null && banner.filter?.minDiscount !== undefined ? String(banner.filter.minDiscount) : NONE}
                onValueChange={(value) =>
                  value && updateFilter(index, { minDiscount: value === NONE ? null : Number(value) })
                }
              >
                <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Any</SelectItem>
                  {DISCOUNT_OPTIONS.map((discount) => (
                    <SelectItem key={discount} value={String(discount)}>{discount}%+</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
