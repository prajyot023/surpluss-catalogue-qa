import { apiClient } from "@/lib/api/client";
import type { ProductSearchPage, UpdateListingInput } from "@/lib/schemas/listing";

export async function searchProducts(
  query: string,
  options: { catalogueId?: string; cursor?: string | null } = {},
): Promise<ProductSearchPage> {
  const params: Record<string, string> = { query };
  if (options.catalogueId) params.catalogueId = options.catalogueId;
  if (options.cursor) params.cursor = options.cursor;
  const response = await apiClient.get<ProductSearchPage>("/api/admin/products/search", { params });
  return response.data;
}

export async function addListings(catalogueId: string, productIds: string[]): Promise<number> {
  const response = await apiClient.post<{ ok: true; added: number }>(
    `/api/admin/catalogues/${catalogueId}/listings`,
    { productIds },
  );
  return response.data.added;
}

export async function updateListing(
  catalogueId: string,
  listingId: string,
  input: UpdateListingInput,
): Promise<void> {
  await apiClient.patch(`/api/admin/catalogues/${catalogueId}/listings/${listingId}`, input);
}

export async function removeListing(catalogueId: string, listingId: string): Promise<void> {
  await apiClient.delete(`/api/admin/catalogues/${catalogueId}/listings/${listingId}`);
}

export async function reorderListings(catalogueId: string, orderedIds: string[]): Promise<void> {
  await apiClient.put(`/api/admin/catalogues/${catalogueId}/listings/order`, { orderedIds });
}
