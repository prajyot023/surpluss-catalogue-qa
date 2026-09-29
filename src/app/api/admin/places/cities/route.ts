import { NextResponse } from "next/server";
import { auth } from "@/auth";

export type CitySuggestion = {
  placeId: string;
  name: string;
  region: string | null;
};

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
};

/** City suggestions from Google Places Autocomplete, for the stock-by-city
 * pickers. Returns `missingKey: true` when GOOGLE_MAPS_API_KEY is not set so
 * the UI can fall back to manual entry. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const sessionToken = searchParams.get("session") ?? undefined;
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ suggestions: [], missingKey: true });

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: ["(cities)"],
        ...(sessionToken ? { sessionToken } : {}),
      }),
    });
    if (!response.ok) return NextResponse.json({ suggestions: [], failed: true });
    const data = (await response.json()) as AutocompleteResponse;
    const suggestions: CitySuggestion[] = (data.suggestions ?? [])
      .map(({ placePrediction }) => ({
        placeId: placePrediction?.placeId ?? "",
        name: placePrediction?.structuredFormat?.mainText?.text ?? "",
        region: placePrediction?.structuredFormat?.secondaryText?.text ?? null,
      }))
      .filter((suggestion) => suggestion.placeId && suggestion.name)
      .slice(0, 6);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [], failed: true });
  }
}
