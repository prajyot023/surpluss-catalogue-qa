import { apiClient } from "@/lib/api/client";
import type { BadgePresetDto, ListingBadge } from "@/lib/badges";

export async function createBadgePreset(input: ListingBadge): Promise<BadgePresetDto> {
  const response = await apiClient.post<{ ok: true; preset: BadgePresetDto }>(
    "/api/admin/badge-presets",
    input,
  );
  return response.data.preset;
}

export async function updateBadgePreset(id: string, input: ListingBadge): Promise<void> {
  await apiClient.patch(`/api/admin/badge-presets/${id}`, input);
}

export async function deleteBadgePreset(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/badge-presets/${id}`);
}
