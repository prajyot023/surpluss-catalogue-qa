import { z } from "zod";
import { OFFER_PRICE_REQUIRED_MESSAGE } from "@/lib/pricing";
import {
  DESCRIPTION_CHARS_MESSAGE,
  DESCRIPTION_LINES_MESSAGE,
  DESCRIPTION_MAX_CHARS,
  DESCRIPTION_MAX_LINES,
  DESCRIPTION_MAX_STORED_CHARS,
  countRichText,
} from "@/lib/rich-text";

export const PRODUCT_NAME_MAX_LENGTH = 70;

export const PRODUCT_NAME_MIN_MESSAGE = "Product title must be at least 2 characters.";

export const PRODUCT_NAME_MAX_MESSAGE = `Product title cannot be longer than ${PRODUCT_NAME_MAX_LENGTH} characters.`;

export const productNameSchema = z
  .string()
  .trim()
  .min(2, PRODUCT_NAME_MIN_MESSAGE)
  .max(PRODUCT_NAME_MAX_LENGTH, PRODUCT_NAME_MAX_MESSAGE);

export const productDescriptionSchema = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX_STORED_CHARS)
  .refine((value) => countRichText(value).chars <= DESCRIPTION_MAX_CHARS, DESCRIPTION_CHARS_MESSAGE)
  .refine((value) => countRichText(value).lines <= DESCRIPTION_MAX_LINES, DESCRIPTION_LINES_MESSAGE);

/** Messages the schemas above write for admins. Zod's own defaults and the
 * internal description storage guard stay behind the generic fallback. */
const ADMIN_FACING_MESSAGES = new Set<string>([
  PRODUCT_NAME_MIN_MESSAGE,
  PRODUCT_NAME_MAX_MESSAGE,
  DESCRIPTION_CHARS_MESSAGE,
  DESCRIPTION_LINES_MESSAGE,
  OFFER_PRICE_REQUIRED_MESSAGE,
]);

/** The first field message worth showing an admin, or null when the failure
 * only carries messages meant for us. */
export function productFieldMessage(error: z.ZodError): string | null {
  return error.issues.find((issue) => ADMIN_FACING_MESSAGES.has(issue.message))?.message ?? null;
}

const money = z
  .number()
  .nonnegative("Price cannot be negative.")
  .max(999_999_999)
  .multipleOf(0.01, "Use at most 2 decimal places.");

export const productPricesUpdateSchema = z
  .array(
    z.object({
      id: z.uuid(),
      mrp: money.nullable(),
      offerPrice: money.nullable(),
    }),
  )
  .min(1)
  .max(500);

export type ProductPricesUpdateInput = z.infer<typeof productPricesUpdateSchema>;

export type IncompleteProduct = {
  id: string;
  sku: string;
  name: string;
  mrp: number | null;
  offerPrice: number | null;
  priceOnRequest: boolean;
  quantity: number;
};
