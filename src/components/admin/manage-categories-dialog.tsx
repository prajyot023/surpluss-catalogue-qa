"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { IconArrowsExchange, IconTag } from "@tabler/icons-react";
import { reassignCategory } from "@/app/admin/products/actions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CategorySummary = { name: string; count: number };

type CategoryAction = { type: "rename" | "move" | "remove"; name: string };

function productCount(count: number) {
  return `${count} product${count === 1 ? "" : "s"}`;
}

/** Library-wide category housekeeping: rename, merge into another category,
 * move all products across, or remove a category (products are kept). */
export function ManageCategoriesDialog({
  categories,
  onClose,
}: {
  categories: CategorySummary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [action, setAction] = useState<CategoryAction | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveTarget, setMoveTarget] = useState("");
  const [pending, startTransition] = useTransition();

  const countFor = (name: string) =>
    categories.find((category) => category.name === name)?.count ?? 0;

  const otherCategories = useMemo(
    () => categories.filter((category) => category.name !== action?.name),
    [categories, action],
  );

  function begin(type: CategoryAction["type"], name: string) {
    setAction({ type, name });
    setRenameValue(name);
    setMoveTarget("");
  }

  function run(from: string, to: string | null, message: (updated: number) => string) {
    startTransition(async () => {
      const result = await reassignCategory(from, to);
      if ("error" in result) {
        appToast.error("Could not update the category", result.error);
        return;
      }
      appToast.success("Categories updated", message(result.updated));
      setAction(null);
      router.refresh();
    });
  }

  const trimmedRename = renameValue.trim();
  const mergeTarget =
    action?.type === "rename" &&
    trimmedRename &&
    trimmedRename !== action.name &&
    categories.some((category) => category.name === trimmedRename)
      ? trimmedRename
      : null;

  function submit() {
    if (!action) return;
    if (action.type === "rename") {
      if (!trimmedRename || trimmedRename === action.name) return;
      run(action.name, trimmedRename, (updated) =>
        mergeTarget
          ? `${productCount(updated)} merged into ${trimmedRename}.`
          : `${action.name} is now called ${trimmedRename}.`,
      );
    } else if (action.type === "move") {
      if (!moveTarget) return;
      run(action.name, moveTarget, (updated) => `${productCount(updated)} moved to ${moveTarget}.`);
    } else {
      run(action.name, null, (updated) => `Category removed from ${productCount(updated)}.`);
    }
  }

  const submitDisabled =
    pending ||
    (action?.type === "rename" && (!trimmedRename || trimmedRename === action.name)) ||
    (action?.type === "move" && !moveTarget);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {action === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Manage categories</DialogTitle>
              <DialogDescription>
                Rename a category, move its products into another one, or remove it. Products are
                never deleted here.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {categories.map((category) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                    <IconTag className="size-4 shrink-0 text-slate-400" />
                    <span className="truncate">{category.name}</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-500">{productCount(category.count)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${category.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="min-w-64">
                        <DropdownMenuItem onClick={() => begin("rename", category.name)}>
                          <Pencil /> Rename
                        </DropdownMenuItem>
                        {categories.length > 1 && (
                          <DropdownMenuItem onClick={() => begin("move", category.name)}>
                            <IconArrowsExchange /> Move products to another category
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => begin("remove", category.name)}
                          className="text-red-600"
                        >
                          <Trash2 /> Remove category
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {!categories.length && (
                <p className="py-8 text-center text-sm text-slate-500">
                  No categories yet. Set one on a product and it shows up here.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {action.type === "rename" && `Rename ${action.name}`}
                {action.type === "move" && `Move products out of ${action.name}`}
                {action.type === "remove" && `Remove ${action.name}?`}
              </DialogTitle>
              <DialogDescription>
                {action.type === "rename" &&
                  `All ${productCount(countFor(action.name))} in this category follow the new name. Typing an existing category merges the two.`}
                {action.type === "move" &&
                  `All ${productCount(countFor(action.name))} switch to the category you pick, and ${action.name} disappears from the list.`}
                {action.type === "remove" &&
                  `Its ${productCount(countFor(action.name))} are kept with everything else intact, just without a category.`}
              </DialogDescription>
            </DialogHeader>
            {action.type === "rename" && (
              <div className="space-y-2">
                <Input
                  autoFocus
                  value={renameValue}
                  maxLength={80}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !submitDisabled) submit();
                  }}
                  aria-label="New category name"
                  placeholder="New category name"
                />
                {mergeTarget && (
                  <p className="text-xs text-amber-600">
                    {mergeTarget} already exists. Saving merges both into one category of{" "}
                    {productCount(countFor(action.name) + countFor(mergeTarget))}.
                  </p>
                )}
              </div>
            )}
            {action.type === "move" && (
              <Select
                items={Object.fromEntries(
                  otherCategories.map((category) => [category.name, category.name]),
                )}
                value={moveTarget || null}
                onValueChange={(value) => {
                  if (value) setMoveTarget(String(value));
                }}
              >
                <SelectTrigger aria-label="Move products to" className="w-full">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {otherCategories.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name}{" "}
                      <span className="text-slate-400">({productCount(category.count)})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAction(null)} disabled={pending}>
                Back
              </Button>
              <Button
                onClick={submit}
                disabled={submitDisabled}
                className={
                  action.type === "remove"
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-brand text-white"
                }
              >
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" /> Saving…
                  </>
                ) : action.type === "rename" ? (
                  mergeTarget ? "Merge categories" : "Rename"
                ) : action.type === "move" ? (
                  "Move products"
                ) : (
                  "Remove category"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
