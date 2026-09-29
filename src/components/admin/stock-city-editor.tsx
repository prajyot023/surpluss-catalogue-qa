"use client";

import { IconX } from "@tabler/icons-react";
import { CitySearch, type CityOption } from "@/components/admin/city-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StockRowEdit = CityOption & { quantity: string };

export function stockRowsTotal(rows: StockRowEdit[]) {
  return rows.reduce((sum, row) => {
    const parsed = Number.parseInt(row.quantity, 10);
    return sum + (Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
  }, 0);
}

/** Per-city stock rows with an add-city picker. Shared by the table's stock
 * popover and the product editor dialog. */
export function StockCityEditor({
  rows,
  onChange,
  knownCities = [],
  /** Prefill for the first row's quantity (the product's unlocated stock). */
  firstRowQuantity,
}: {
  rows: StockRowEdit[];
  onChange: (rows: StockRowEdit[]) => void;
  knownCities?: CityOption[];
  firstRowQuantity?: number;
}) {
  function addCity(city: CityOption) {
    const quantity = rows.length === 0 && firstRowQuantity !== undefined ? String(firstRowQuantity) : "0";
    onChange([...rows, { ...city, quantity }]);
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.placeId} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{row.name}</p>
            {row.region && <p className="truncate text-xs text-slate-400">{row.region}</p>}
          </div>
          <Input
            type="number"
            min={0}
            step={1}
            value={row.quantity}
            onChange={(event) =>
              onChange(
                rows.map((current) =>
                  current.placeId === row.placeId ? { ...current, quantity: event.target.value } : current,
                ),
              )
            }
            aria-label={`Stock in ${row.name}`}
            className="h-8 w-20 px-2 text-sm tabular-nums"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${row.name}`}
            onClick={() => onChange(rows.filter((current) => current.placeId !== row.placeId))}
            className="text-slate-400 hover:text-red-600"
          >
            <IconX />
          </Button>
        </div>
      ))}
      <CitySearch
        onSelect={addCity}
        exclude={rows.map((row) => row.placeId)}
        knownCities={knownCities}
        placeholder={rows.length ? "Add another city" : "Add a city"}
      />
    </div>
  );
}
