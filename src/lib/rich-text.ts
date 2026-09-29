export const DESCRIPTION_MAX_CHARS = 2000;
export const DESCRIPTION_MAX_LINES = 10;

export const DESCRIPTION_MAX_STORED_CHARS = 20_000;

export const DESCRIPTION_CHARS_MESSAGE = `Keep the description under ${DESCRIPTION_MAX_CHARS} characters.`;
export const DESCRIPTION_LINES_MESSAGE = `Keep the description to ${DESCRIPTION_MAX_LINES} lines or fewer.`;

const MAX_DEPTH = 6;

export type RichTextMark = { type: "bold" | "italic" };

export type RichTextInline =
  | { type: "text"; text: string; marks?: RichTextMark[] }
  | { type: "hardBreak" };

export type RichTextBlock =
  | { type: "paragraph"; content?: RichTextInline[] }
  | { type: "bulletList"; content?: RichTextListItem[] };

export type RichTextListItem = { type: "listItem"; content?: RichTextBlock[] };

export type RichTextDoc = { type: "doc"; content?: RichTextBlock[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMarks(value: unknown): RichTextMark[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const marks = value.filter(
    (mark): mark is RichTextMark =>
      isRecord(mark) && (mark.type === "bold" || mark.type === "italic"),
  );

  return marks.length ? marks.map(({ type }) => ({ type })) : undefined;
}

function parseInline(value: unknown): RichTextInline[] {
  if (!Array.isArray(value)) return [];

  const nodes: RichTextInline[] = [];

  for (const node of value) {
    if (!isRecord(node)) continue;

    if (node.type === "hardBreak") {
      nodes.push({ type: "hardBreak" });
    } else if (node.type === "text" && typeof node.text === "string") {
      nodes.push({ type: "text", text: node.text, marks: parseMarks(node.marks) });
    }
  }

  return nodes;
}

function parseListItems(value: unknown, depth: number): RichTextListItem[] {
  if (!Array.isArray(value)) return [];

  const items: RichTextListItem[] = [];

  for (const node of value) {
    if (!isRecord(node) || node.type !== "listItem") continue;
    items.push({ type: "listItem", content: parseBlocks(node.content, depth + 1) });
  }

  return items;
}

function parseBlocks(value: unknown, depth = 0): RichTextBlock[] {
  if (!Array.isArray(value) || depth > MAX_DEPTH) return [];

  const blocks: RichTextBlock[] = [];

  for (const node of value) {
    if (!isRecord(node)) continue;

    if (node.type === "paragraph") {
      blocks.push({ type: "paragraph", content: parseInline(node.content) });
    } else if (node.type === "bulletList") {
      blocks.push({ type: "bulletList", content: parseListItems(node.content, depth) });
    }
  }

  return blocks;
}

export function parseRichText(value: string): RichTextDoc | null {
  const trimmed = value.trim();

  if (!trimmed.startsWith("{")) return null;

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || parsed.type !== "doc") return null;

  return { type: "doc", content: parseBlocks(parsed.content) };
}

function blocksToLines(blocks: RichTextBlock[]): string[] {
  const lines: string[] = [];

  for (const block of blocks) {
    if (block.type === "bulletList") {
      for (const item of block.content ?? []) {
        lines.push(...blocksToLines(item.content ?? []));
      }
      continue;
    }

    let line = "";

    for (const node of block.content ?? []) {
      if (node.type === "hardBreak") {
        lines.push(line);
        line = "";
      } else {
        line += node.text;
      }
    }

    lines.push(line);
  }

  return lines;
}

function toLines(value: string): string[] {
  const doc = parseRichText(value);

  return doc ? blocksToLines(doc.content ?? []) : value.split("\n");
}

export function richTextToPlainText(value: string): string {
  return parseRichText(value) ? toLines(value).join("\n") : value;
}

export function countRichText(value: string): { chars: number; lines: number } {
  const lines = toLines(value);
  const chars = lines.reduce((total, line) => total + line.length, 0);

  return {
    chars,
    lines: chars === 0 ? 0 : lines.length,
  };
}

export function descriptionLimitError(counts: { chars: number; lines: number }): string | null {
  if (counts.chars > DESCRIPTION_MAX_CHARS) return DESCRIPTION_CHARS_MESSAGE;
  if (counts.lines > DESCRIPTION_MAX_LINES) return DESCRIPTION_LINES_MESSAGE;

  return null;
}

export function hasRichTextContent(value: string): boolean {
  return richTextToPlainText(value).trim().length > 0;
}

export function toEditorDoc(value: string): RichTextDoc {
  const doc = parseRichText(value);

  if (doc) return doc;

  return {
    type: "doc",
    content: value.split("\n").map((line) =>
      line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" },
    ),
  };
}
