"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BookmarkPlus, Check, Loader2, Pencil, Plus, Tags, X } from "lucide-react";
import { createBadgePreset, deleteBadgePreset, updateBadgePreset } from "@/lib/api/badge-presets";
import { updateListing } from "@/lib/api/listings";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  BADGE_SWATCHES,
  BADGE_TEXT_MAX_LENGTH,
  MAX_BADGES_PER_LISTING,
  type BadgePresetDto,
  type BadgeTextColor,
  type ListingBadge,
} from "@/lib/badges";
import type { ListingRowDto } from "@/lib/schemas/listing";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function BadgePill({ badge, className }: { badge: ListingBadge; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold", className)}
      style={{ backgroundColor: badge.bg, color: badge.fg }}
    >
      {badge.text}
    </span>
  );
}

/** Per-row badge editor. Every change saves straight away: tap a library
 * badge to put it on the product, tap x to take it off, and creating a new
 * badge stores it in the library and applies it in one go. */
export function ListingBadgesEditor({
  catalogueId,
  row,
  presets,
  disabled = false,
}: {
  catalogueId: string;
  row: ListingRowDto;
  /** The saved badge library, newest first. */
  presets: BadgePresetDto[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Optimistic copy of the applied badges so taps feel instant; when the
  // server refresh delivers new row data, reset to it during render.
  const [badges, setBadges] = useState<ListingBadge[]>(row.badges);
  const [syncedRowBadges, setSyncedRowBadges] = useState(row.badges);
  if (syncedRowBadges !== row.badges) {
    setSyncedRowBadges(row.badges);
    setBadges(row.badges);
  }

  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BadgePresetDto | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<BadgePresetDto | null>(null);
  const [promotingText, setPromotingText] = useState<string | null>(null);
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [newText, setNewText] = useState("");
  const [newBg, setNewBg] = useState<string>(BADGE_SWATCHES[0]);
  const [newFg, setNewFg] = useState<BadgeTextColor>("black");

  const appliedTexts = useMemo(
    () => new Set(badges.map((badge) => badge.text.toLowerCase())),
    [badges],
  );
  const full = badges.length >= MAX_BADGES_PER_LISTING;
  const busy = pending || creating || deletingId !== null || promotingText !== null;
  const presetTexts = useMemo(
    () => new Set(presets.map((preset) => preset.text.toLowerCase())),
    [presets],
  );

  async function apply(next: ListingBadge[]) {
    const previous = badges;
    setBadges(next);
    setPending(true);
    try {
      await updateListing(catalogueId, row.listingId, { badges: next });
      router.refresh();
    } catch (error) {
      setBadges(previous);
      appToast.error("Could not update the badges", getApiErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  function addBadge(badge: ListingBadge) {
    if (full || busy || appliedTexts.has(badge.text.toLowerCase())) return;
    apply([...badges, { text: badge.text, bg: badge.bg, fg: badge.fg }]);
  }

  function removeBadge(badge: ListingBadge) {
    if (busy) return;
    apply(badges.filter((item) => item !== badge));
  }

  function startEdit(preset: BadgePresetDto) {
    setEditing(preset);
    setNewText(preset.text);
    setNewBg(preset.bg);
    setNewFg(preset.fg);
  }

  function cancelEdit() {
    setEditing(null);
    setNewText("");
    setNewBg(BADGE_SWATCHES[0]);
    setNewFg("black");
  }

  async function submitForm() {
    const text = newText.trim();
    if (!text || busy) return;
    setCreating(true);
    try {
      if (editing) {
        await updateBadgePreset(editing.id, { text, bg: newBg, fg: newFg });
        appToast.success("Badge updated", "Products keep badges already applied.");
        cancelEdit();
        router.refresh();
      } else if (saveToLibrary) {
        const preset = await createBadgePreset({ text, bg: newBg, fg: newFg });
        setNewText("");
        router.refresh();
        if (!full) await apply([...badges, preset]);
      } else {
        // One-off badge: applied to this product only, never stored.
        setNewText("");
        await apply([...badges, { text, bg: newBg, fg: newFg }]);
      }
    } catch (error) {
      appToast.error(
        editing ? "Could not update the badge" : "Could not create the badge",
        getApiErrorMessage(error),
      );
    } finally {
      setCreating(false);
    }
  }

  /** Saves a badge that only exists on this product into the shared library. */
  async function promoteBadge(badge: ListingBadge) {
    if (busy) return;
    setPromotingText(badge.text);
    try {
      await createBadgePreset(badge);
      appToast.success("Saved to Your badges", "It is now available for every product.");
      router.refresh();
    } catch (error) {
      appToast.error("Could not save the badge", getApiErrorMessage(error));
    } finally {
      setPromotingText(null);
    }
  }

  async function removePreset(preset: BadgePresetDto) {
    if (deletingId !== null) return;
    setDeletingId(preset.id);
    try {
      await deleteBadgePreset(preset.id);
      if (editing?.id === preset.id) cancelEdit();
      setConfirmingDelete(null);
      appToast.success("Badge deleted", "Products keep badges already applied.");
      router.refresh();
    } catch (error) {
      appToast.error("Could not delete the badge", getApiErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      cancelEdit();
      setSaveToLibrary(true);
    } else {
      setConfirmingDelete(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={`Edit badges for ${row.product.name}`}
            className="focus-ring flex min-h-7 flex-wrap items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
          >
            {badges.length ? (
              badges.map((badge) => <BadgePill key={badge.text} badge={badge} />)
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                <Tags className="size-3.5" /> Add
              </span>
            )}
          </button>
        }
      />
      <PopoverContent align="end" className="w-80 p-4">
        {confirmingDelete ? (
          <>
            <div>
              <p className="font-semibold">Delete this badge?</p>
              <div className="mt-2">
                <BadgePill badge={confirmingDelete} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                It disappears from your badges everywhere. Products that already have it keep it
                until you remove it from them.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingDelete(null)}
                disabled={deletingId !== null}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => removePreset(confirmingDelete)}
                disabled={deletingId !== null}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deletingId !== null ? (
                  <><Loader2 className="animate-spin" /> Deleting…</>
                ) : (
                  "Delete badge"
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">Badges</p>
            <p className="mt-0.5 text-xs text-slate-500">Changes save automatically.</p>
          </div>
          {pending && <Loader2 className="mt-1 size-3.5 animate-spin text-slate-400" />}
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            On this product
          </p>
          <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-slate-200 p-2">
            {badges.map((badge) => {
              const inLibrary = presetTexts.has(badge.text.toLowerCase());
              return (
                <span key={badge.text} className="inline-flex items-center">
                  <BadgePill badge={badge} className="rounded-r-none" />
                  {!inLibrary && (
                    <button
                      type="button"
                      aria-label={`Save ${badge.text} to Your badges`}
                      title="Save to Your badges"
                      onClick={() => promoteBadge(badge)}
                      disabled={busy}
                      className="focus-ring inline-flex items-center border-l border-black/10 py-0.5 px-0.5 opacity-80 hover:opacity-100 disabled:opacity-40"
                      style={{ backgroundColor: badge.bg, color: badge.fg }}
                    >
                      {promotingText === badge.text ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <BookmarkPlus className="size-3" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${badge.text} from this product`}
                    onClick={() => removeBadge(badge)}
                    className="focus-ring inline-flex items-center rounded-r-md border-l border-black/10 py-0.5 pl-0.5 pr-1 opacity-80 hover:opacity-100"
                    style={{ backgroundColor: badge.bg, color: badge.fg }}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            {!badges.length && (
              <span className="text-xs text-slate-400">None yet. Tap a badge below to add it.</span>
            )}
          </div>
          {full && (
            <p className="mt-1.5 text-[11px] text-amber-600">
              Limit of {MAX_BADGES_PER_LISTING} reached. Remove one to add another.
            </p>
          )}
        </div>

        {presets.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Your badges
            </p>
            <div className="flex flex-wrap gap-x-2 gap-y-1.5">
              {presets.map((preset) => {
                const applied = appliedTexts.has(preset.text.toLowerCase());
                return (
                <span key={preset.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (applied) {
                        const current = badges.find(
                          (badge) => badge.text.toLowerCase() === preset.text.toLowerCase(),
                        );
                        if (current) removeBadge(current);
                      } else {
                        addBadge(preset);
                      }
                    }}
                    disabled={busy || (!applied && full)}
                    aria-pressed={applied}
                    aria-label={
                      applied
                        ? `Remove ${preset.text} from this product`
                        : `Add ${preset.text} to this product`
                    }
                    className={cn(
                      "focus-ring inline-flex items-center gap-1 rounded-l-md px-2 py-1 text-[11px] font-bold hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40",
                      applied && "ring-2 ring-inset ring-black/20",
                    )}
                    style={{ backgroundColor: preset.bg, color: preset.fg }}
                  >
                    {applied ? <Check className="size-3" /> : <Plus className="size-3" />} {preset.text}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(preset)}
                    disabled={busy}
                    aria-label={`Edit ${preset.text}`}
                    className="focus-ring inline-flex items-center self-stretch border-l border-black/10 py-1 px-1 opacity-70 hover:opacity-100 disabled:opacity-40"
                    style={{ backgroundColor: preset.bg, color: preset.fg }}
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(preset)}
                    disabled={busy}
                    aria-label={`Delete ${preset.text} from the library`}
                    className="focus-ring inline-flex items-center self-stretch rounded-r-md border-l border-black/10 py-1 pl-1 pr-1.5 opacity-70 hover:opacity-100 disabled:opacity-40"
                    style={{ backgroundColor: preset.bg, color: preset.fg }}
                  >
                    <X className="size-3" />
                  </button>
                </span>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {editing ? `Edit "${editing.text}"` : "New badge"}
          </p>
          <div className="flex items-center gap-1.5">
            <Input
              value={newText}
              maxLength={BADGE_TEXT_MAX_LENGTH}
              placeholder="Badge text"
              onChange={(event) => setNewText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitForm();
                }
              }}
              className="h-8 flex-1 text-sm"
            />
            <div className="flex shrink-0 gap-1">
              {(["black", "white"] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`${color} text`}
                  aria-pressed={newFg === color}
                  onClick={() => setNewFg(color)}
                  className={cn(
                    "focus-ring grid size-8 place-items-center rounded-md border text-xs font-bold",
                    color === "black"
                      ? "border-slate-200 bg-white text-black"
                      : "border-slate-700 bg-slate-800 text-white",
                    newFg === color ? "ring-2 ring-brand ring-offset-1" : "opacity-60 hover:opacity-100",
                  )}
                >
                  A
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BADGE_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`Background color ${hex}`}
                aria-pressed={newBg === hex}
                onClick={() => setNewBg(hex)}
                className={cn(
                  "focus-ring size-6 rounded-full transition-transform",
                  newBg === hex ? "scale-110 ring-2 ring-brand ring-offset-2" : "hover:scale-105",
                )}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          {!editing && (
            <label className="mt-2.5 flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-600">
              <Checkbox
                checked={saveToLibrary}
                onCheckedChange={(checked) => setSaveToLibrary(checked === true)}
              />
              Save to Your badges for reuse
            </label>
          )}
          <div className="mt-2.5 flex min-h-8 items-center justify-between gap-2">
            {newText.trim() ? (
              <BadgePill badge={{ text: newText.trim(), bg: newBg, fg: newFg }} />
            ) : (
              <span className="text-[11px] text-slate-400">Preview appears here.</span>
            )}
            <div className="flex shrink-0 gap-1.5">
              {editing && (
                <Button type="button" variant="outline" size="sm" onClick={cancelEdit} disabled={busy}>
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={submitForm}
                disabled={!newText.trim() || busy || (!editing && !saveToLibrary && full)}
                className="bg-brand text-white"
              >
                {creating ? <Loader2 className="animate-spin" /> : editing ? null : <Plus />}
                {editing
                  ? "Save changes"
                  : !saveToLibrary
                    ? "Add to product"
                    : full
                      ? "Save to library"
                      : "Create and add"}
              </Button>
            </div>
          </div>
        </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
