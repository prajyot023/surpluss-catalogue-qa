"use client";

import { IconChevronDown, IconLoader2 } from "@tabler/icons-react";
import type { CityOption } from "@/components/admin/city-search";
import { StockCityEditor, stockRowsTotal, type StockRowEdit } from "@/components/admin/stock-city-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Unsaved stock state for one product. `rows: null` means the product is
 * unlocated and only the plain quantity is edited; a rows array (even empty,
 * which clears the breakdown on save) means stock is managed by city. */
export type StockEdit = {
  rows: StockRowEdit[] | null;
  quantity: string;
};

function parseQuantity(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function StockCell({
  productName,
  edit,
  onChange,
  knownCities,
  dirty,
  saving,
  onSave,
}: {
  productName: string;
  edit: StockEdit;
  onChange: (edit: StockEdit) => void;
  knownCities: CityOption[];
  /** This product has unsaved stock edits. */
  dirty: boolean;
  saving: boolean;
  /** Saves this product's stock right from the popover. */
  onSave: () => void;
}) {
  const located = edit.rows !== null && edit.rows.length > 0;
  const total = located ? stockRowsTotal(edit.rows!) : parseQuantity(edit.quantity);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Stock for ${productName}`}
            className="focus-ring group flex items-center gap-1.5 rounded-md py-0.5"
          >
            <Badge
              variant="outline"
              className={
                total < 100
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200"
              }
            >
              {total}
            </Badge>
            {located ? (
              <span className="flex items-center gap-1">
                {edit.rows!.slice(0, 2).map((stockRow) => (
                  <span
                    key={stockRow.placeId}
                    className="flex max-w-28 items-baseline gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                  >
                    <span className="truncate">{stockRow.name}</span>
                    <span className="font-semibold tabular-nums text-slate-500">
                      {parseQuantity(stockRow.quantity)}
                    </span>
                  </span>
                ))}
                {edit.rows!.length > 2 && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 transition-colors group-hover:bg-slate-200">
                    +{edit.rows!.length - 2} more
                  </span>
                )}
              </span>
            ) : (
              <IconChevronDown className="size-3.5 text-slate-300 transition-colors group-hover:text-slate-500" />
            )}
          </button>
        }
      />
      <PopoverContent align="start" className="w-80 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Stock by city
        </p>
        {!located && (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm text-slate-600">Total stock</p>
            <Input
              type="number"
              min={0}
              step={1}
              value={edit.quantity}
              onChange={(event) => onChange({ ...edit, quantity: event.target.value })}
              aria-label={`Total stock for ${productName}`}
              className="h-8 w-20 px-2 text-sm tabular-nums"
            />
          </div>
        )}
        <StockCityEditor
          rows={edit.rows ?? []}
          onChange={(rows) => onChange({ ...edit, rows })}
          knownCities={knownCities}
          firstRowQuantity={parseQuantity(edit.quantity)}
        />
        <div
          className={cn(
            "flex items-center justify-between border-t border-slate-100 pt-2 text-sm",
            !located && "hidden",
          )}
        >
          <span className="text-slate-500">Total</span>
          <span className="font-semibold tabular-nums text-slate-800">{total}</span>
        </div>
        {dirty ? (
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="w-full bg-brand text-white"
          >
            {saving ? (
              <>
                <IconLoader2 className="animate-spin" /> Saving…
              </>
            ) : (
              "Save stock"
            )}
          </Button>
        ) : (
          <p className="text-[11px] leading-4 text-slate-400">
            {located
              ? "The total is the sum of the cities."
              : "Add a city to split this stock by location."}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
