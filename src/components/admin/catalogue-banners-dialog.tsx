"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { IconArrowLeft, IconCheck, IconLoader2, IconPhoto, IconSettings, IconSparkles } from "@tabler/icons-react";
import { updateCatalogueBanners } from "@/app/admin/catalogues/actions";
import { BannerEditor } from "@/components/admin/banner-editor";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CatalogueBanner } from "@/lib/schemas/catalogue";
import { cn } from "@/lib/utils";

type Step = "images" | "actions" | "review";

const STEPS: { id: Step; label: string; icon: typeof IconPhoto }[] = [
  { id: "images", label: "Images", icon: IconPhoto },
  { id: "actions", label: "Tap action", icon: IconSettings },
  { id: "review", label: "Review", icon: IconCheck },
];

const STEP_COPY: Record<Step, { title: string; description: string }> = {
  images: {
    title: "Catalogue banners",
    description: "Upload up to three wide images. Buyers see them above the product filters.",
  },
  actions: {
    title: "Choose what each banner does",
    description: "A banner can open a category, sort products, or highlight a minimum discount.",
  },
  review: {
    title: "Review and save",
    description: "Check the order and tap behavior before updating the catalogue.",
  },
};

function describeAction(banner: CatalogueBanner) {
  const parts: string[] = [];
  if (banner.filter?.category) parts.push(banner.filter.category);
  if (banner.filter?.sort === "discount") parts.push("highest discount first");
  if (banner.filter?.sort === "price-asc") parts.push("lowest price first");
  if (banner.filter?.sort === "price-desc") parts.push("highest price first");
  if (banner.filter?.sort === "featured") parts.push("featured order");
  if (banner.filter?.minDiscount) parts.push(`${banner.filter.minDiscount}%+ discount`);
  return parts.length ? parts.join(" · ") : "Shows all products in their current order";
}

function StepProgress({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Banner setup progress">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const active = index === currentIndex;
        const complete = index < currentIndex;
        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
              active && "border-brand/30 bg-brand/5 text-brand",
              complete && "border-emerald-200 bg-emerald-50 text-emerald-700",
              !active && !complete && "border-slate-200 text-slate-400",
            )}
          >
            <span className={cn("grid size-6 place-items-center rounded-full", active ? "bg-brand text-white" : complete ? "bg-emerald-600 text-white" : "bg-slate-100")}>
              {complete ? <IconCheck className="size-3.5" /> : <Icon className="size-3.5" />}
            </span>
            <span className="hidden sm:inline">{index + 1}. {step.label}</span>
            <span className="sm:hidden">{index + 1}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function CatalogueBannersDialog({
  catalogueId,
  catalogueName,
  initialBanners,
  categories,
  onOpenChange,
}: {
  catalogueId: string;
  catalogueName: string;
  initialBanners: CatalogueBanner[];
  categories: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<Step>("images");
  const [banners, setBanners] = useState<CatalogueBanner[]>(
    initialBanners.length ? initialBanners : [{ imageUrl: "", filter: null }],
  );
  const [pending, startTransition] = useTransition();
  const readyBanners = banners.filter((banner) => banner.imageUrl);
  const hasIncompleteSlot = banners.some((banner) => !banner.imageUrl);
  const canContinue = !hasIncompleteSlot && (readyBanners.length > 0 || initialBanners.length > 0);

  function save() {
    startTransition(async () => {
      const result = await updateCatalogueBanners(catalogueId, readyBanners);
      if ("error" in result) {
        appToast.error("Could not save the banners", result.error);
        return;
      }
      appToast.success(
        readyBanners.length ? "Banners updated" : "Banners removed",
        catalogueName,
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!pending) onOpenChange(open); }}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <div className="pr-8">
            <DialogTitle>{STEP_COPY[step].title}</DialogTitle>
            <DialogDescription className="mt-1">{STEP_COPY[step].description}</DialogDescription>
          </div>
          <div className="mt-4">
            <StepProgress current={step} />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-slate-50/60 px-6 py-5">
          {step === "images" && (
            <BannerEditor banners={banners} onChange={setBanners} categories={categories} mode="images" />
          )}

          {step === "actions" && (
            <>
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-sm text-blue-800">
                <IconSparkles className="mt-0.5 size-4 shrink-0" />
                <p>Tap actions are optional. Leave all three fields unchanged to use the banner as a visual promotion only.</p>
              </div>
              <BannerEditor banners={readyBanners} onChange={setBanners} categories={categories} mode="actions" />
            </>
          )}

          {step === "review" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {readyBanners.map((banner, index) => (
                <article key={banner.imageUrl} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[5/2] bg-slate-100">
                    <Image src={banner.imageUrl} alt={`Banner ${index + 1} preview`} fill sizes="360px" className="object-cover" />
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
                      {index + 1}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-xs font-semibold text-slate-800">When tapped</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{describeAction(banner)}</p>
                  </div>
                </article>
              ))}
              {!readyBanners.length && (
                <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                  <IconPhoto className="mx-auto size-7 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">Remove all banners?</p>
                  <p className="mt-1 text-xs text-slate-500">The product catalogue will start directly with its filters.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4">
          {step === "images" ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          ) : (
            <Button variant="outline" disabled={pending} onClick={() => setStep(step === "review" ? "actions" : "images")}>
              <IconArrowLeft /> Back
            </Button>
          )}
          {step === "images" && (
            <Button disabled={!canContinue} onClick={() => setStep(readyBanners.length ? "actions" : "review")} className="bg-brand text-white">
              Continue
            </Button>
          )}
          {step === "actions" && (
            <Button onClick={() => setStep("review")} className="bg-brand text-white">Review banners</Button>
          )}
          {step === "review" && (
            <Button disabled={pending} onClick={save} className="bg-brand text-white">
              {pending ? <><IconLoader2 className="animate-spin" /> Saving…</> : "Save banners"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
