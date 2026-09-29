"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appToast } from "@/components/ui/app-toast";

type ShareLeadButtonProps = {
  reference: string;
  buyerName: string;
  company?: string | null;
  phone?: string;
  email?: string | null;
  catalogueName: string;
  totalQuantity: number;
  status: string;
  products?: {
    name: string;
    quantity: number;
  }[];
};

export function ShareLeadButton({
  reference,
  buyerName,
  company,
  phone,
  email,
  catalogueName,
  totalQuantity,
  status,
  products = [],
}: ShareLeadButtonProps) {
  async function handleShare() {
    const leadUrl = `${window.location.origin}/admin/leads/${reference}`;
    const shareText = [
        "Surpluss Lead Details",
        "",
        `Buyer: ${buyerName}`,
        company ? `Company: ${company}` : null,
        phone ? `Phone: ${phone}` : null,
        email ? `Email: ${email}` : null,
        `Campaign: ${catalogueName}`,
        "",
        products.length ? "Requested Products:" : null,
        ...products.map(
          (product, index) =>
            `${index + 1}. ${product.name} - ${product.quantity.toLocaleString("en-IN")} units`,
        ),
        "",
        `Total Quantity: ${totalQuantity.toLocaleString("en-IN")} units`,
        `Reference: ${reference}`,
        `Status: ${status}`,
        "",
        `View Lead Details: ${leadUrl}`,
      ]
        .filter(Boolean)
        .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Lead ${reference}`,
          text: shareText,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      appToast.success("Lead details copied", "Share options are not available in this browser.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      appToast.error("Unable to share lead", "Please try again.");
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleShare}>
      <Share2 />
      Share lead
    </Button>
  );
}