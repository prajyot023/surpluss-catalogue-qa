"use client";

import { useEffect, useRef, useState } from "react";
import { IconMapPin, IconPlus } from "@tabler/icons-react";
import { apiClient } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CityOption = {
  placeId: string;
  name: string;
  region: string | null;
};

type SuggestResponse = {
  suggestions: CityOption[];
  missingKey?: boolean;
  failed?: boolean;
};

/** Ids for cities typed without the Places API; normalised so the same name
 * always resolves to one city row. */
function manualPlaceId(name: string) {
  return `manual:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/** City picker: suggests from Google Places plus cities already in use, with a
 * plain "Add" fallback when the API key is missing or the lookup fails. */
export function CitySearch({
  onSelect,
  exclude = [],
  knownCities = [],
  placeholder = "Add a city",
  autoFocus,
}: {
  onSelect: (city: CityOption) => void;
  /** placeIds already picked, hidden from suggestions. */
  exclude?: string[];
  /** Cities already in use in the library, matched before the API. */
  knownCities?: CityOption[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  // Results tagged with the query they answer, so stale fetches never show.
  const [fetched, setFetched] = useState<{
    q: string;
    list: CityOption[];
    unavailable: boolean;
  }>({ q: "", list: [], unavailable: false });
  const [open, setOpen] = useState(false);
  // One Places billing session per mounted picker, renewed after each pick.
  const sessionToken = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const wanted = query.trim();
    if (wanted.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      apiClient
        .get<SuggestResponse>("/api/admin/places/cities", {
          params: { q: wanted, session: sessionToken.current },
        })
        .then((response) => {
          if (cancelled) return;
          setFetched({
            q: wanted,
            list: response.data.suggestions,
            unavailable: Boolean(response.data.missingKey || response.data.failed),
          });
        })
        .catch(() => {
          if (cancelled) return;
          setFetched({ q: wanted, list: [], unavailable: true });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const trimmed = query.trim();
  const suggestions = fetched.q === trimmed ? fetched.list : [];
  const apiUnavailable = fetched.q === trimmed && fetched.unavailable;
  const needle = trimmed.toLowerCase();
  const excluded = new Set(exclude);

  const known = trimmed.length >= 2
    ? knownCities.filter(
        (city) => city.name.toLowerCase().includes(needle) && !excluded.has(city.placeId),
      )
    : [];
  const knownIds = new Set(known.map((city) => city.placeId));
  const fromApi = suggestions.filter(
    (city) => !excluded.has(city.placeId) && !knownIds.has(city.placeId),
  );
  const options = [...known, ...fromApi].slice(0, 6);
  // Manual entry only when nothing matched, so typos don't compete with
  // canonical Places results.
  const manual =
    apiUnavailable && trimmed.length >= 2 && options.length === 0 && !excluded.has(manualPlaceId(trimmed))
      ? { placeId: manualPlaceId(trimmed), name: trimmed, region: null }
      : null;

  function pick(city: CityOption) {
    onSelect(city);
    setQuery("");
    setFetched({ q: "", list: [], unavailable: false });
    setOpen(false);
    sessionToken.current = crypto.randomUUID();
  }

  const showList = open && trimmed.length >= 2 && (options.length > 0 || manual !== null);

  return (
    <div className="relative">
      <IconMapPin className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={query}
        autoFocus={autoFocus}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Let option clicks land before the list closes.
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        maxLength={120}
        className="h-8 pl-8 text-sm"
        aria-label={placeholder}
      />
      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-md">
          {options.map((city) => (
            <button
              key={city.placeId}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(city)}
              className={cn(
                "flex w-full items-baseline gap-1.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-50",
              )}
            >
              <span className="font-medium text-slate-800">{city.name}</span>
              {city.region && <span className="truncate text-xs text-slate-400">{city.region}</span>}
            </button>
          ))}
          {manual && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(manual)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm font-medium text-brand transition-colors hover:bg-slate-50"
            >
              <IconPlus className="size-3.5" /> Add &quot;{manual.name}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
