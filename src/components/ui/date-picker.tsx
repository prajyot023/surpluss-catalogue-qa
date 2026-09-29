"use client";

import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-start font-normal", !value && "text-slate-500", className)}
          >
            <CalendarIcon className="size-4 text-slate-400" />
            {value ? value.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : placeholder}
            {value && (
              <span
                role="button"
                aria-label="Clear date"
                className="ml-auto rounded p-0.5 hover:bg-slate-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(undefined);
                }}
              >
                <X className="size-3.5 text-slate-400" />
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          disabled={disabled}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
