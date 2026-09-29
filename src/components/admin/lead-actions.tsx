"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveLeadNotes, updateLeadStatus } from "@/app/admin/leads/actions";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost" | "spam";

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "spam", label: "Spam" },
];

export function LeadActions({ reference, status, internalNotes }: { reference: string; status: LeadStatus; internalNotes: string | null }) {
  const router = useRouter();
  const [notes, setNotes] = useState(internalNotes ?? "");
  const [pending, startTransition] = useTransition();

  function changeStatus(next: LeadStatus) {
    if (next === status) return;
    startTransition(async () => {
      const result = await updateLeadStatus(reference, next);
      if (result.error) appToast.error("Could not update status", result.error);
      else {
        appToast.success("Status updated", `${reference} is now ${next}.`);
        router.refresh();
      }
    });
  }

  function submitNotes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveLeadNotes(reference, notes);
      if (result.error) appToast.error("Could not save notes", result.error);
      else {
        appToast.success("Notes saved", "Only the team can see internal notes.");
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Manage lead</h2>
      <div className="mt-4">
        <Label htmlFor="lead-status">Status</Label>
        <Select
          items={statusOptions}
          value={status}
          disabled={pending}
          onValueChange={(value) => value && changeStatus(value as LeadStatus)}
        >
          <SelectTrigger id="lead-status" className="mt-1.5 h-10 w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <form onSubmit={submitNotes} className="mt-4">
        <Label htmlFor="lead-notes">Internal notes</Label>
        <Textarea
          id="lead-notes"
          value={notes}
          maxLength={4000}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-1.5 min-h-24"
          placeholder="Call outcomes, pricing discussed, next steps…"
        />
        <Button type="submit" disabled={pending} variant="outline" className="mt-3 w-full">
          {pending ? <><Loader2 className="animate-spin" /> Saving…</> : "Save notes"}
        </Button>
      </form>
    </section>
  );
}
