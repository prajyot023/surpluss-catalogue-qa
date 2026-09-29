import { apiClient } from "@/lib/api/client";
import type { CatalogueDetailDto, CatalogueEditInput } from "@/lib/schemas/catalogue";

export async function fetchCatalogue(id: string): Promise<CatalogueDetailDto> {
  const response = await apiClient.get<CatalogueDetailDto>(`/api/admin/catalogues/${id}`);
  return response.data;
}

export async function updateCatalogue(
  id: string,
  input: CatalogueEditInput,
): Promise<CatalogueDetailDto> {
  const response = await apiClient.patch<{ ok: true; catalogue: CatalogueDetailDto }>(
    `/api/admin/catalogues/${id}`,
    input,
  );
  return response.data.catalogue;
}
