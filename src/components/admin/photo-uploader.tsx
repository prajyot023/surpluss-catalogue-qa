"use client";

import Image from "next/image";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { appToast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_MB = 5;

export type UploadKind = "product" | "catalogue-cover" | "catalogue-banner";

async function uploadToS3(file: File, kind: UploadKind): Promise<string> {
  let presign: { uploadUrl?: string; publicUrl?: string | null };
  try {
    const response = await apiClient.post<{ uploadUrl: string; publicUrl: string | null }>(
      "/api/uploads/presign",
      { fileName: file.name, contentType: file.type, kind },
    );
    presign = response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Could not prepare the upload."));
  }
  if (!presign.uploadUrl || !presign.publicUrl) {
    throw new Error("Uploads are not fully configured (missing CloudFront URL).");
  }
  // Deliberately a raw fetch: the presigned S3 URL is cross-origin and its signature
  // covers the exact headers — the shared axios interceptors would break it.
  const putResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putResponse.ok) throw new Error(`Storage rejected the upload (${putResponse.status}).`);
  return presign.publicUrl;
}

export function PhotoUploader({
  images,
  onChange,
  max = 6,
  kind = "product",
  helperText,
  variant = "photos",
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  kind?: UploadKind;
  helperText?: string;
  variant?: "photos" | "banner";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const room = max - images.length;
    const files = Array.from(fileList).slice(0, room);
    if (fileList.length > room) appToast.warning(`Only ${max} ${max === 1 ? "photo" : "photos"} allowed here`, "Extra files were skipped.");

    const valid = files.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        appToast.error("Unsupported format", `${file.name}: use JPG, PNG or WebP.`);
        return false;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        appToast.error("File too large", `${file.name}: keep photos under ${MAX_FILE_MB} MB.`);
        return false;
      }
      return true;
    });
    if (!valid.length) return;

    setUploading(valid.length);
    const uploaded: string[] = [];
    for (const file of valid) {
      try {
        uploaded.push(await uploadToS3(file, kind));
        setUploading((count) => count - 1);
      } catch (error) {
        setUploading(0);
        appToast.error("Upload failed", error instanceof Error ? error.message : "Please try again.");
        break;
      }
    }
    if (uploaded.length) {
      onChange([...images, ...uploaded]);
      appToast.success(uploaded.length === 1 ? "Photo uploaded" : `${uploaded.length} photos uploaded`);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple={max > 1}
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className={cn("mt-1.5 grid gap-2", variant === "banner" ? "grid-cols-1" : "grid-cols-4 sm:grid-cols-5")}>
        {images.map((url, index) => (
          <div
            key={url}
            className={cn(
              "group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50",
              variant === "banner" ? "aspect-[5/2]" : "aspect-square",
            )}
          >
            <Image src={url} alt={`Photo ${index + 1}`} fill sizes={variant === "banner" ? "720px" : "96px"} className="object-cover" />
            {index === 0 && max > 1 && <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1 py-0.5 text-[9px] font-bold text-slate-600">Cover</span>}
            {index > 0 && max > 1 && (
              <button
                type="button"
                aria-label={`Make photo ${index + 1} the cover`}
                title="Set as cover"
                onClick={() => onChange([url, ...images.filter((item) => item !== url)])}
                className="absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:text-amber-500"
              >
                <Star className="size-3" />
              </button>
            )}
            <button
              type="button"
              aria-label={`Remove photo ${index + 1}`}
              onClick={() => onChange(images.filter((item) => item !== url))}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:text-red-600"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {uploading > 0 && (
          <div className={cn("grid place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50", variant === "banner" ? "aspect-[5/2]" : "aspect-square")}>
            <Loader2 className="size-4 animate-spin text-slate-400" />
          </div>
        )}
        {images.length + uploading < max && (
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading > 0}
            className={cn(
              "h-auto flex-col gap-1 rounded-lg border-dashed font-medium text-slate-500",
              variant === "banner" ? "aspect-[5/2] text-xs" : "aspect-square text-[10px]",
            )}
          >
            <ImagePlus className={variant === "banner" ? "size-5" : "size-4"} />
            {variant === "banner" ? "Upload wide image" : "Upload"}
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        {helperText ?? `JPG, PNG or WebP · up to ${MAX_FILE_MB} MB each · max ${max} photos. First photo is the cover.`}
      </p>
    </div>
  );
}
