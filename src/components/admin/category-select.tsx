"use client";

import { useEffect, useMemo, useState } from "react";
import { IconArrowBackUp, IconPlus } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";
const ADD_NEW = "__add_new__";

type OptionKind = "product" | "catalogue" | "brand";

/** Picker fed by values already in use (categories or brands), with an inline
 * "Add new" mode that swaps the dropdown for a text input. */
export function CategorySelect({
  kind,
  value,
  onChange,
  id,
}: {
  kind: OptionKind;
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const noun = kind === "brand" ? "brand" : "category";
  const placeholder = kind === "brand" ? "No brand" : "No category";
  const reducedMotion = useReducedMotion();
  const [options, setOptions] = useState<string[]>([]);
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ categories: string[] }>("/api/admin/categories", { params: { kind } })
      .then((response) => {
        if (!cancelled) setOptions(response.data.categories);
      })
      .catch(() => {
        // The dropdown still works with just the current value; adding new stays possible.
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const allOptions = useMemo(() => {
    const set = new Set(options);
    if (value.trim()) set.add(value.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [options, value]);

  if (addingNew) {
    return (
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="flex gap-2"
      >
        <Input
          id={id}
          autoFocus
          value={value}
          maxLength={80}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Type the new ${noun}`}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Back to the ${noun} list`}
          onClick={() => {
            onChange("");
            setAddingNew(false);
          }}
        >
          <IconArrowBackUp />
        </Button>
      </motion.div>
    );
  }

  const selectItems: Record<string, string> = {
    [NONE]: placeholder,
    ...Object.fromEntries(allOptions.map((option) => [option, option])),
    [ADD_NEW]: `Add new ${noun}`,
  };

  return (
    <Select
      items={selectItems}
      value={value.trim() ? value.trim() : NONE}
      onValueChange={(next) => {
        if (!next) return;
        if (next === ADD_NEW) {
          onChange("");
          setAddingNew(true);
          return;
        }
        onChange(next === NONE ? "" : String(next));
      }}
    >
      <SelectTrigger id={id} aria-label={noun === "brand" ? "Brand" : "Category"} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {allOptions.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
        <SelectItem value={ADD_NEW}>
          <span className="flex items-center gap-1.5 font-medium text-brand">
            <IconPlus className="size-3.5" /> Add new {noun}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
