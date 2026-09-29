export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Sanitizer for typing directly in a slug input: lowercases and swaps spaces
 * for dashes on every keystroke, but keeps a trailing dash so the next word
 * can be typed. Run full slugify() on blur or submit. */
export function slugifyInput(value: string) {
  return value.toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-/, "");
}
