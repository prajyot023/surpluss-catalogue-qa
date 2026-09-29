"use client";

import Image from "next/image";
import { useState } from "react";
import { z } from "zod";
import {
  IconCircleCheck,
  IconLoader2,
  IconMessageCircle,
  IconMinus,
  IconPackage,
  IconPhotoOff,
  IconPlus,
  IconStack2,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { trackEvent } from "@/lib/analytics";
import type { ProductView } from "@/lib/catalogue-queries";
import { waHref } from "@/components/catalogue/whatsapp-cta";
import { discountPercent, priceLabel } from "@/lib/pricing";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, money } from "@/lib/utils";

const COUNTRY_CODES = [
  ["🇮🇳", "+91"],
  ["🇦🇪", "+971"],
  ["🇺🇸", "+1"],
  ["🇬🇧", "+44"],
  ["🇸🇬", "+65"],
] as const;

const nameSchema = z.string().trim().min(2, "Please enter your full name");
const phoneSchema = z
  .string()
  .regex(/^\d{6,10}$/, "Enter a valid WhatsApp number.");

const STORAGE_KEY = "surpluss-contact-details";

type SavedDetails = { name: string; countryCode: string; phone: string };
type FieldErrors = { name?: string; phone?: string };

function loadSavedDetails(): SavedDetails {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedDetails>;
      return {
        name: typeof parsed.name === "string" ? parsed.name : "",
        countryCode:
          typeof parsed.countryCode === "string" ? parsed.countryCode : "+91",
        phone: typeof parsed.phone === "string" ? parsed.phone : "",
      };
    }
  } catch {
    // Private mode or blocked storage: start empty.
  }
  return { name: "", countryCode: "+91", phone: "" };
}

function saveDetails(details: SavedDetails) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch {
    // Best effort only.
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

// Rendered only while open, keyed by product id:
// {contacting && <ContactSupplierDialog key={product.id} .../>}
export function ContactSupplierDialog({
  catalogueId,
  product,
  whatsappNumber,
  onClose,
}: {
  catalogueId: string;
  product: ProductView;
  whatsappNumber: string | null;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  // Details are remembered in the browser so repeat buyers never retype them.
  const [details, setDetails] = useState<SavedDetails>(loadSavedDetails);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [quantity, setQuantity] = useState(product.moq);
  // Free-typed quantity before it is clamped on blur or submit.
  const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
  const [referralPerson, setReferralPerson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const discount = discountPercent({
    priceOnRequest: product.priceOnRequest,
    mrp: product.mrp,
    offerPrice: product.price,
  });
  const maxQuantity = Math.max(product.moq, product.quantity);

  function clampQuantity(value: number) {
    return Math.min(maxQuantity, Math.max(product.moq, value));
  }

  function changeQuantity(delta: number) {
    const next = clampQuantity(resolvedQuantity() + delta);
    setQuantityDraft(null);
    setQuantity(next);
  }

  // The typed value, clamped; falls back to the last committed quantity.
  function resolvedQuantity() {
    if (quantityDraft !== null) {
      const parsed = Number.parseInt(quantityDraft, 10);
      if (!Number.isNaN(parsed)) return clampQuantity(parsed);
    }
    return quantity;
  }

  function commitQuantityDraft() {
    setQuantity(resolvedQuantity());
    setQuantityDraft(null);
  }

  function validateField(field: "name" | "phone") {
    const result =
      field === "name"
        ? nameSchema.safeParse(details.name)
        : phoneSchema.safeParse(details.phone);
    setErrors((current) => ({
      ...current,
      [field]: result.success ? undefined : result.error.issues[0]?.message,
    }));
    return result.success;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nameOk = validateField("name");
    const phoneOk = validateField("phone");
    if (!nameOk || !phoneOk) return;
    // Commit any quantity still being typed so the payload and the success
    // screen match what the buyer sees.
    const finalQuantity = resolvedQuantity();
    setQuantity(finalQuantity);
    setQuantityDraft(null);
    setSubmitting(true);
    try {
      const response = await apiClient.post<{ ok: true; reference: string }>(
        "/api/enquiries",
        {
          catalogueId,
          name: details.name.trim(),
          countryCode: details.countryCode,
          phone: details.phone,
          referralPerson: referralPerson.trim() || undefined,
          items: [{ productId: product.id, quantity: finalQuantity }],
        },
      );
      saveDetails(details);
      setReference(response.data.reference ?? null);
      // No PII here: only the product, quantity and reference code go to GA4.
      trackEvent("generate_lead", {
        ...(product.price !== null
          ? { currency: "INR", value: product.price * finalQuantity }
          : {}),
        item_id: product.id,
        item_name: product.name,
        quantity: finalQuantity,
        enquiry_reference: response.data.reference ?? undefined,
      });
    } catch (error) {
      appToast.error(
        "Could not send your enquiry",
        getApiErrorMessage(error, "Check your connection and try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const chatHref = reference
    ? waHref(
        whatsappNumber,
        `Hi Surpluss team! I just sent enquiry ${reference} for "${product.name}" (${quantity.toLocaleString("en-IN")} units). Sharing a few more details:`,
      )
    : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Contact supplier</DialogTitle>
          <DialogDescription>
            Send an enquiry for {product.name}
          </DialogDescription>
        </DialogHeader>

        {reference ? (
          <div className="px-6 py-8">
            <div className="text-center">
              <motion.div
                initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 20 }}
                className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"
              >
                <IconCircleCheck className="size-7" />
              </motion.div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-brand">
                Enquiry sent
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Reference{" "}
                <span className="font-mono font-semibold text-brand">
                  {reference}
                </span>
              </p>
            </div>

            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.25 }}
              className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-slate-300">
                    <IconPhotoOff className="size-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand">
                  {product.name}
                </p>
                <p className="text-xs text-slate-500">
                  {quantity.toLocaleString("en-IN")} units
                  {product.price !== null
                    ? ` · ${money(product.price)} per unit`
                    : ""}
                </p>
              </div>
            </motion.div>

            <motion.ol
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.25 }}
              className="mt-5 space-y-2.5"
            >
              {[
                "The Surpluss team checks stock and confirms your quantity.",
                `You get a WhatsApp reply on ${details.countryCode} ${details.phone} within 24 hours.`,
              ].map((step, index) => (
                <li
                  key={step}
                  className="flex items-start gap-2.5 text-sm text-slate-600"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand/5 font-mono text-[10px] font-bold text-brand">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </motion.ol>

            <div className="mt-6 grid gap-2">
              {chatHref && (
                <a
                  href={chatHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackEvent("whatsapp_click", {
                      link_location: "post_enquiry",
                      item_id: product.id,
                    })
                  }
                  className="focus-ring flex h-11 items-center justify-center gap-2 rounded-xl bg-whatsapp text-sm font-semibold text-white transition-colors hover:bg-whatsapp-hover"
                >
                  <IconMessageCircle className="size-4.5" /> Chat with us now on
                  WhatsApp
                </a>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                className="h-11 rounded-xl"
              >
                Keep browsing
              </Button>
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              Know more about us at{" "}
              <a
                href="https://surpluss.co"
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring font-semibold text-brand underline underline-offset-2"
              >
                surpluss.co
              </a>
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-[260px_minmax(0,1fr)]">
            {/* The product they are asking about. */}
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:block sm:border-b-0 sm:border-r sm:p-5">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:mb-3 sm:aspect-square sm:size-auto sm:w-full sm:rounded-xl">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 64px, 260px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-slate-300">
                    <IconPhotoOff className="size-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  {[product.brand, product.sku].filter(Boolean).join(" · ")}
                </p>
                <h3 className="mt-0.5 text-sm font-semibold leading-snug text-brand sm:text-base">
                  {product.name}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-base font-bold tracking-tight text-brand">
                    {priceLabel(
                      {
                        priceOnRequest: product.priceOnRequest,
                        offerPrice: product.price,
                      },
                      money,
                    )}
                  </span>
                  {product.mrp !== null && (
                    <span className="text-xs text-slate-400 line-through">
                      {money(product.mrp)}
                    </span>
                  )}
                  {discount > 0 && (
                    <span className="rounded bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {discount}% off
                    </span>
                  )}
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {[
                    {
                      icon: IconStack2,
                      label: "Minimum Order Quantity",
                      value: `${product.moq.toLocaleString("en-IN")} units`,
                    },
                    {
                      icon: IconPackage,
                      label: "In stock",
                      value: `${product.quantity.toLocaleString("en-IN")} units`,
                    },
                  ].map((line) => (
                    <li
                      key={line.label}
                      className="flex items-center gap-2 text-xs text-slate-800"
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200">
                        <line.icon className="size-3" />
                      </span>
                      {line.label}:{" "}
                      <span className="font-semibold text-slate-700">
                        {line.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* The three things the supplier needs. */}
            <form onSubmit={submit} className="p-5" noValidate>
              <h3 className="text-lg font-semibold tracking-tight text-brand">
                Contact supplier
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                The Surpluss team replies on WhatsApp within 24 hours.
              </p>
              <div className="mt-4 grid gap-3.5">
                <div>
                  <Label htmlFor="contact-name">Your name *</Label>
                  <Input
                    id="contact-name"
                    value={details.name}
                    onChange={(event) =>
                      setDetails((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    onBlur={() => validateField("name")}
                    aria-invalid={Boolean(errors.name)}
                    maxLength={100}
                    className="mt-1.5 h-10"
                    placeholder="Full name"
                  />
                  <FieldError message={errors.name} />
                </div>
                <div>
                  <Label htmlFor="contact-phone">WhatsApp number *</Label>
                  <div className="mt-1.5 flex">
                    <Select
                      items={COUNTRY_CODES.map(([flag, code]) => ({
                        value: code,
                        label: `${flag} ${code}`,
                      }))}
                      value={details.countryCode}
                      onValueChange={(value) =>
                        value &&
                        setDetails((current) => ({
                          ...current,
                          countryCode: String(value),
                        }))
                      }
                    >
                      <SelectTrigger
                        aria-label="Country code"
                        className="h-10 w-26 shrink-0 rounded-r-none border-r-0 bg-slate-50 data-[size=default]:h-10"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map(([flag, code]) => (
                          <SelectItem key={code} value={code}>
                            {flag} {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="contact-phone"
                      type="tel"
                      inputMode="numeric"
                      value={details.phone}
                      onChange={(event) =>
                        setDetails((current) => ({
                          ...current,
                          // Digits only: typing letters or symbols does nothing.
                          phone: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10),
                        }))
                      }
                      onBlur={() => validateField("phone")}
                      aria-invalid={Boolean(errors.phone)}
                      maxLength={10}
                      className={cn(
                        "h-10 rounded-l-none",
                        errors.phone && "border-red-300",
                      )}
                      placeholder="98765 43210"
                    />
                  </div>
                  <FieldError message={errors.phone} />
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="contact-quantity">Quantity</Label>
                    <span className="text-[11px] text-slate-400">
                      Min {product.moq.toLocaleString("en-IN")} · Max{" "}
                      {maxQuantity.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="mt-1.5 flex w-fit items-stretch overflow-hidden rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => changeQuantity(-product.moq)}
                      disabled={quantityDraft === null && quantity <= product.moq}
                      aria-label="Decrease quantity"
                      className="grid size-10 place-items-center text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <IconMinus className="size-3.5" />
                    </button>
                    <input
                      id="contact-quantity"
                      type="text"
                      inputMode="numeric"
                      value={quantityDraft ?? quantity.toLocaleString("en-IN")}
                      onChange={(event) =>
                        setQuantityDraft(
                          event.target.value.replace(/\D/g, "").slice(0, 7),
                        )
                      }
                      onFocus={(event) => {
                        setQuantityDraft(String(quantity));
                        event.target.select();
                      }}
                      onBlur={commitQuantityDraft}
                      aria-label="Quantity in units"
                      className="w-20 border-x border-slate-200 bg-slate-50/60 px-2 text-center text-sm font-semibold tabular-nums outline-none transition-colors focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => changeQuantity(product.moq)}
                      disabled={quantityDraft === null && quantity >= maxQuantity}
                      aria-label="Increase quantity"
                      className="grid size-10 place-items-center text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <IconPlus className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="referral-person">
                    Referral Person
                    <span className="font-normal text-slate-400">
                      {" "}(optional)
                    </span>
                  </Label>

                  <Input
                    id="referral-person"
                    value={referralPerson}
                    onChange={(event) => setReferralPerson(event.target.value)}
                    maxLength={100}
                    className="mt-1.5 h-10"
                    placeholder="Enter person's name"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="h-11 rounded-xl bg-contact text-white hover:bg-brand-hover"
                >
                  {submitting ? (
                    <>
                      <IconLoader2 className="animate-spin" /> Sending…
                    </>
                  ) : (
                    "Send enquiry"
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
