"use client";

import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBan,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconFileSpreadsheet,
  IconLoader2,
  IconPhotoPlus,
  IconSparkles,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  checkExistingSkus,
  importProducts,
  type ImportedProduct,
  type ImportProductsResult,
} from "@/app/admin/products/import-actions";
import { updateProductImages } from "@/app/admin/products/actions";
import {
  autoMap,
  FIELD_LABELS,
  FIELDS,
  SAMPLE_SHEET,
  validateRows,
  type FieldKey,
  type ImportRow,
  type ParsedFile,
} from "@/lib/import-mapping";
import CountUp from "@/components/CountUp";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { appToast } from "@/components/ui/app-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadCsv } from "@/lib/csv";
import { cn, money } from "@/lib/utils";

type Step = "upload" | "match" | "check" | "importing" | "done";

const DOT_STEPS = ["upload", "match", "check", "done"] as const;
const STEP_TITLES: Record<Step, string> = {
  upload: "Upload your sheet",
  match: "Match the columns",
  check: "Check before importing",
  importing: "Importing your products",
  done: "All done",
};
const STEP_HINTS: Record<Step, string> = {
  upload: "Bring in many products at once from a CSV sheet.",
  match: "Tell us what each column means. We matched most of them for you.",
  check: "A quick look at what will be imported.",
  importing: "Hang tight. This takes a moment.",
  done: "Your products are in the library. Add photos right here if you like.",
};

function StepDots({ current }: { current: Step }) {
  const activeIndex = DOT_STEPS.indexOf(current === "importing" ? "done" : (current as (typeof DOT_STEPS)[number]));
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${activeIndex + 1} of ${DOT_STEPS.length}`}>
      {DOT_STEPS.map((step, index) => (
        <motion.span
          key={step}
          layout
          className={cn(
            "h-1.5 rounded-full",
            index === activeIndex ? "w-6 bg-brand" : index < activeIndex ? "w-3 bg-brand/50" : "w-3 bg-slate-200",
          )}
        />
      ))}
    </div>
  );
}

/** Collapsible group used by the Check step (Ready / Need a look / Skipped). */
function CheckSection({
  tone,
  icon,
  title,
  count,
  defaultOpen = true,
  children,
}: {
  tone: "ready" | "warn" | "skip";
  icon: React.ReactNode;
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneClasses = {
    ready: "text-emerald-600",
    warn: "text-amber-500",
    skip: "text-red-500",
  }[tone];
  if (count === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <span className={cn("[&>svg]:size-4.5", toneClasses)}>{icon}</span>
        <span className="flex-1 text-sm font-semibold">{title}</span>
        <Badge variant="outline" className="border-slate-200 text-slate-600">{count}</Badge>
        <IconChevronDown className={cn("size-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="max-h-56 overflow-y-auto border-t border-slate-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One product line in the importing/done list, with an inline photo uploader
 * that appears once the product is saved. */
function ResultRow({
  index,
  name,
  sku,
  importing,
  product,
  reducedMotion,
}: {
  index: number;
  name: string;
  sku: string;
  importing: boolean;
  product: ImportedProduct | null;
  reducedMotion: boolean;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasPhotos = (product?.hasImage ?? false) || images.length > 0;

  async function persist(next: string[]) {
    if (!product) return;
    const previous = images;
    setImages(next);
    setSaving(true);
    const result = await updateProductImages(product.id, next);
    setSaving(false);
    if (result.error) {
      setImages(previous);
      appToast.error("Could not save the photos", result.error);
    }
  }

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: reducedMotion ? 0 : Math.min(index * 0.05, 1.4) }}
      className="border-b border-slate-100 last:border-0"
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate font-mono text-xs text-slate-500">{sku}</p>
        </div>
        {importing ? (
          <IconLoader2 className="size-4 shrink-0 animate-spin text-slate-400" />
        ) : (
          <>
            {saving ? (
              <IconLoader2 className="size-4 shrink-0 animate-spin text-slate-400" />
            ) : (
              <motion.span
                initial={reducedMotion ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 20 }}
                className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"
              >
                <IconCheck className="size-3.5" />
              </motion.span>
            )}
            {product && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPhotosOpen((value) => !value)}
                className={cn("shrink-0", hasPhotos && "text-emerald-700")}
              >
                <IconPhotoPlus />
                {hasPhotos ? `Photos (${Math.max(images.length, product.hasImage ? 1 : 0)})` : "Add photos"}
              </Button>
            )}
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
        {photosOpen && product && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
              <PhotoUploader images={images} onChange={persist} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Rendered only while open so all wizard state resets between imports:
// {importing && <ImportProductsDialog onClose={...} />}
export function ImportProductsDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, FieldKey>>({});
  const [existingSkus, setExistingSkus] = useState<string[] | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<Extract<ImportProductsResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(selected: File | undefined) {
    if (!selected) return;
    if (selected.size > 10 * 1024 * 1024) {
      appToast.error("File too large", "Keep the sheet under 10 MB.");
      return;
    }
    if (!/\.csv$/i.test(selected.name)) {
      appToast.error("CSV files only", "Export your Excel sheet as CSV (File, Save As, CSV) and upload that.");
      return;
    }
    Papa.parse<Record<string, string>>(selected, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: (parsed) => {
        const headers = (parsed.meta.fields ?? []).filter(Boolean);
        const rows = parsed.data;
        if (!headers.length || !rows.length) {
          appToast.error("Could not read the sheet", "The file needs a header row and at least one product row.");
          return;
        }
        if (rows.length > 2000) {
          appToast.error("Too many rows", "Imports are limited to 2,000 rows per file. Split the sheet and try again.");
          return;
        }
        setFile({ name: selected.name, sizeKB: Math.max(1, Math.round(selected.size / 1024)), headers, rows });
        setMapping(autoMap(headers));
        appToast.success("Sheet read", `${rows.length} rows and ${headers.length} columns found.`);
      },
      error: () => appToast.error("Could not read the sheet", "The file doesn't look like a valid CSV."),
    });
  }

  const autoMatched = useMemo(
    () => Object.values(mapping).filter((field) => field !== "attribute" && field !== "ignore").length,
    [mapping],
  );
  const requiredMapped = useMemo(() => {
    const mapped = new Set(Object.values(mapping));
    return FIELDS.filter((field) => field.required).every((field) => mapped.has(field.key));
  }, [mapping]);

  const validation = useMemo(
    () => (file ? validateRows(file, mapping) : { rows: [], issues: [], warnings: 0, missingPrices: 0 }),
    [file, mapping],
  );
  const blockingIssues = validation.issues.filter((issue) => issue.blocking);
  const warningIssues = validation.issues.filter((issue) => !issue.blocking);

  // Which valid rows already exist in the library (loaded when entering Check).
  useEffect(() => {
    if (step !== "check" || !validation.rows.length) return;
    let cancelled = false;
    checkExistingSkus(validation.rows.map(({ sku }) => sku)).then((response) => {
      if (cancelled) return;
      if ("error" in response) {
        appToast.error("Could not check your library", response.error);
        setExistingSkus([]);
        return;
      }
      setExistingSkus(response.existing);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function goToCheck() {
    setExistingSkus(null);
    setUpdateExisting(false);
    setStep("check");
  }

  const existingSet = useMemo(() => new Set(existingSkus ?? []), [existingSkus]);
  const readyRows = useMemo(
    () => validation.rows.filter((row) => updateExisting || !existingSet.has(row.sku)),
    [validation.rows, updateExisting, existingSet],
  );
  const skippedExistingRows = useMemo(
    () => (updateExisting ? [] : validation.rows.filter((row) => existingSet.has(row.sku))),
    [validation.rows, updateExisting, existingSet],
  );
  const existingCount = validation.rows.filter((row) => existingSet.has(row.sku)).length;
  const importCount = readyRows.length;
  const skippedTotal = blockingIssues.length + skippedExistingRows.length;

  function runImport() {
    if (!file || importCount === 0) return;
    setStep("importing");
    startTransition(async () => {
      const response = await importProducts({
        fileName: file.name,
        columnMapping: mapping,
        updateExisting,
        rows: validation.rows,
      });
      if ("error" in response) {
        appToast.error("Import failed", response.error);
        setStep("check");
        return;
      }
      setResult(response);
      setStep("done");
      appToast.success(
        "Products imported",
        `${response.created + response.updated} ${response.created + response.updated === 1 ? "product" : "products"} saved to your library.`,
      );
      router.refresh();
    });
  }

  const resultBySku = useMemo(
    () => new Map((result?.products ?? []).map((product) => [product.sku, product])),
    [result],
  );

  function finish() {
    onClose();
    router.refresh();
  }

  const slide = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: 14 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -14 },
        transition: { duration: 0.18 },
      };

  function priceChip(row: ImportRow) {
    if (row.offerPrice === undefined || row.mrp === undefined) {
      return (
        <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700">
          No price yet
        </Badge>
      );
    }
    return <span className="shrink-0 text-sm font-semibold text-slate-700">{money(row.offerPrice)}</span>;
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open || pending || step === "importing") return;
        if (step === "done") finish();
        else onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={step !== "importing"}>
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
            <StepDots current={step} />
          </div>
          <DialogDescription>{STEP_HINTS[step]}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait" initial={false}>
            {step === "upload" && (
              <motion.div key="upload" {...slide}>
                <label className="grid min-h-44 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition hover:border-brand hover:bg-slate-50">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(event) => {
                      handleFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <div>
                    <div className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100">
                      <IconUpload className="size-5" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">Drop your sheet here or click to choose a file</h3>
                    <p className="mt-1 text-xs text-slate-500">CSV only, up to 10 MB and 2,000 rows. Using Excel? Save the sheet as CSV first.</p>
                  </div>
                </label>

                {file && (
                  <motion.div
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                        <IconFileSpreadsheet className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-slate-500">{file.rows.length} rows · {file.headers.length} columns · {file.sizeKB} KB</p>
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={() => { setFile(null); setMapping({}); }}>
                        <IconX />
                      </Button>
                    </div>
                  </motion.div>
                )}

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Needed:</span> SKU, product name, quantity.{" "}
                      <span className="font-semibold text-slate-700">Nice to have:</span> MRP, offer price, brand, photos link.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        downloadCsv("surpluss-sample-inventory.csv", SAMPLE_SHEET);
                        appToast.success("Sample sheet downloaded", "Open it in Excel or Google Sheets and replace the example rows.");
                      }}
                    >
                      <IconFileSpreadsheet /> Sample sheet
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "match" && file && (
              <motion.div key="match" {...slide}>
                <div className="mb-3 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 sm:flex-row sm:items-center">
                  <IconSparkles className="size-5 shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900">{autoMatched} of {file.headers.length} columns matched automatically</p>
                    <p className="text-xs text-blue-700">Check the list below. SKU, product name and quantity are needed.</p>
                  </div>
                  {!requiredMapped && <Badge className="w-fit bg-amber-100 text-amber-800">Some needed columns are not matched yet</Badge>}
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-[1fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:grid-cols-[1fr_1.3fr_1.4fr]">
                    <span>Your column</span>
                    <span>Means</span>
                    <span className="hidden sm:block">Example values</span>
                  </div>
                  {file.headers.map((header) => {
                    const field = FIELDS.find((item) => item.key === mapping[header]);
                    const samples = file.rows.slice(0, 2).map((row) => row[header]).filter(Boolean);
                    return (
                      <div key={header} className="grid grid-cols-[1fr_1fr] items-center gap-4 border-b border-slate-100 px-4 py-2.5 last:border-0 sm:grid-cols-[1fr_1.3fr_1.4fr]">
                        <div>
                          <p className="truncate text-sm font-medium">
                            {header}
                            {field?.required && <span className="ml-0.5 text-rose-500" aria-label="Required">*</span>}
                          </p>
                        </div>
                        <Select
                          items={FIELD_LABELS}
                          value={mapping[header]}
                          onValueChange={(value) => value && setMapping((current) => ({ ...current, [header]: value as FieldKey }))}
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FIELDS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="hidden truncate text-xs text-slate-500 sm:block">{samples.join(" · ") || "No values"}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === "check" && file && (
              <motion.div key="check" {...slide} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Ready to import", value: importCount, tone: "ok" as const },
                    { label: "Need a look", value: warningIssues.length, tone: warningIssues.length ? ("warn" as const) : ("ok" as const) },
                    { label: "Will be skipped", value: skippedTotal, tone: skippedTotal ? ("bad" as const) : ("ok" as const) },
                  ].map((card, index) => (
                    <motion.div
                      key={card.label}
                      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.06 }}
                      className={cn(
                        "rounded-xl border p-4",
                        card.tone === "warn" && card.value ? "border-amber-200 bg-amber-50" : card.tone === "bad" && card.value ? "border-red-200 bg-red-50" : "border-slate-200 bg-white",
                      )}
                    >
                      <p className="text-xs text-slate-500">{card.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {reducedMotion ? card.value : <CountUp to={card.value} duration={0.6} />}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {existingSkus === null && (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <IconLoader2 className="size-3.5 animate-spin" /> Checking your library for these SKUs…
                  </p>
                )}

                {existingCount > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold">{existingCount} of these {existingCount === 1 ? "product is" : "products are"} already in your library</p>
                    <label className="mt-2 flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={updateExisting}
                        onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                        className="mt-0.5"
                      />
                      <span>
                        Also update {existingCount === 1 ? "that product" : `these ${existingCount} products`} with the sheet&apos;s values
                        <span className="block text-xs font-normal text-slate-500">
                          {updateExisting
                            ? "Filled cells replace the old values. Blank cells keep the old values."
                            : "Leave this off to skip them and only add new products."}
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                <CheckSection tone="ready" icon={<IconCircleCheck />} title="Ready to import" count={readyRows.length}>
                  {readyRows.map((row) => (
                    <div key={row.sku} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="truncate font-mono text-xs text-slate-500">{row.sku}</p>
                      </div>
                      {updateExisting && existingSet.has(row.sku) && (
                        <Badge variant="outline" className="shrink-0 border-blue-200 bg-blue-50 text-blue-700">Will update</Badge>
                      )}
                      {priceChip(row)}
                    </div>
                  ))}
                </CheckSection>

                <CheckSection tone="warn" icon={<IconAlertTriangle />} title="Need a look" count={warningIssues.length}>
                  {warningIssues.map((issue, index) => (
                    <div key={index} className="flex items-start gap-2.5 border-b border-slate-100 px-4 py-2 text-sm last:border-0">
                      <span className="mt-0.5 shrink-0 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-700">Row {issue.row}</span>
                      <p className="text-slate-600">{issue.message}. The product still imports.</p>
                    </div>
                  ))}
                </CheckSection>

                <CheckSection tone="skip" icon={<IconBan />} title="Will be skipped" count={skippedTotal} defaultOpen={blockingIssues.length > 0}>
                  {blockingIssues.map((issue, index) => (
                    <div key={index} className="flex items-start gap-2.5 border-b border-slate-100 px-4 py-2 text-sm last:border-0">
                      <span className="mt-0.5 shrink-0 rounded bg-red-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-700">Row {issue.row}</span>
                      <p className="text-slate-600">{issue.message}.</p>
                    </div>
                  ))}
                  {skippedExistingRows.map((row) => (
                    <div key={row.sku} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="truncate font-mono text-xs text-slate-500">{row.sku}</p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">Already in your library</span>
                    </div>
                  ))}
                </CheckSection>

                {validation.missingPrices > 0 && (
                  <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <IconAlertTriangle className="size-5 shrink-0 text-amber-600" />
                    <p className="text-xs leading-5 text-amber-800">
                      <span className="font-semibold">{validation.missingPrices} {validation.missingPrices === 1 ? "product doesn't" : "products don't"} have both prices yet.</span>{" "}
                      You can add MRP and offer price later from the Products page. Prices are needed before a catalogue can go live.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {(step === "importing" || step === "done") && (
              <motion.div key="results" {...slide}>
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {step === "importing" ? (
                        <>Importing {readyRows.length} {readyRows.length === 1 ? "product" : "products"}…</>
                      ) : (
                        <>
                          {[
                            result?.created ? `${result.created} added` : null,
                            result?.updated ? `${result.updated} updated` : null,
                            result?.skippedExisting ? `${result.skippedExisting} skipped` : null,
                            result?.keptStock ? `${result.keptStock} kept city stock` : null,
                            result?.skippedArchived ? `${result.skippedArchived} archived skipped` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Nothing changed"}
                        </>
                      )}
                    </p>
                    {step === "done" && (
                      <motion.span
                        initial={reducedMotion ? false : { scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 320, damping: 20 }}
                        className="grid size-7 place-items-center rounded-full bg-emerald-50 text-emerald-600"
                      >
                        <IconCircleCheck className="size-4.5" />
                      </motion.span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      className="h-full rounded-full bg-brand"
                      initial={{ width: "0%" }}
                      animate={{ width: step === "done" ? "100%" : "90%" }}
                      transition={
                        step === "done"
                          ? { duration: 0.3 }
                          : { duration: Math.min(5, 1 + readyRows.length * 0.05), ease: "easeOut" }
                      }
                    />
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="max-h-80 overflow-y-auto">
                    {readyRows.map((row, index) => (
                      <ResultRow
                        key={row.sku}
                        index={index}
                        name={row.name}
                        sku={row.sku}
                        importing={step === "importing"}
                        product={resultBySku.get(row.sku) ?? null}
                        reducedMotion={reducedMotion}
                      />
                    ))}
                  </div>
                </div>
                {step === "done" && (
                  <p className="mt-3 text-xs text-slate-500">
                    Products with photos get far more buyer attention. You can also add them later from the Products page.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="border-t border-slate-200 px-6 py-4">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!file} onClick={() => setStep("match")} className="bg-brand text-white">Proceed</Button>
            </>
          )}
          {step === "match" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}><IconArrowLeft /> Back</Button>
              <Button disabled={!requiredMapped} onClick={goToCheck} className="bg-brand text-white">Proceed</Button>
            </>
          )}
          {step === "check" && (
            <>
              <Button variant="outline" onClick={() => setStep("match")}><IconArrowLeft /> Back</Button>
              <Button
                onClick={runImport}
                disabled={importCount === 0 || existingSkus === null}
                className="bg-brand text-white"
              >
                <IconCheck /> Import {importCount} {importCount === 1 ? "product" : "products"}
              </Button>
            </>
          )}
          {step === "importing" && (
            <Button disabled className="bg-brand text-white">
              <IconLoader2 className="animate-spin" /> Importing…
            </Button>
          )}
          {step === "done" && (
            <Button onClick={finish} className="bg-brand text-white">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
