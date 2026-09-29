import Link from "next/link";
import { Clock3 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export default function CatalogueUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f9] px-5">
      <div className="max-w-md text-center">
        <BrandMark className="mx-auto mb-10" />
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-white text-slate-500 shadow-sm"><Clock3 /></div>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.035em]">This catalogue is no longer available</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">The deal may have expired or the inventory is no longer active. Contact the Surpluss team for current availability.</p>
        <Link href="mailto:contact@surpluss.in" className="mt-7 inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white">Contact Surpluss</Link>
      </div>
    </main>
  );
}
