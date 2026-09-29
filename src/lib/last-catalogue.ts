const KEY = "surpluss:last-catalogue";

/** Remember the catalogue a visitor opened so the About page can link back to it. */
export function rememberCatalogue(slug: string) {
  try {
    window.localStorage.setItem(KEY, `/catalogue/${slug}`);
  } catch {
    // Storage unavailable (private mode, blocked cookies). Nothing to do.
  }
}

export function getLastCatalogue(): string | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value?.startsWith("/catalogue/") ? value : null;
  } catch {
    return null;
  }
}
