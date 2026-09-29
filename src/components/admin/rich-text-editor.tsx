"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DESCRIPTION_MAX_CHARS,
  DESCRIPTION_MAX_LINES,
  countRichText,
  descriptionLimitError,
  toEditorDoc,
} from "@/lib/rich-text";
import { cn } from "@/lib/utils";

// Only the marks and nodes the renderer allowlists are registered, so pasted
// headings, links or tables are flattened to paragraphs on the way in.
const EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: false,
    orderedList: false,
    strike: false,
    underline: false,
  }),
];

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={active ? "secondary" : "ghost"}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  id,
  value,
  onChange,
}: {
  id: string;
  /** Initial content only; the editor is uncontrolled after mount. */
  value: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: EXTENSIONS,
    content: toEditorDoc(value),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        class: "min-h-20 px-2.5 py-2 outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            isBold: editor.isActive("bold"),
            isItalic: editor.isActive("italic"),
            isBulletList: editor.isActive("bulletList"),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
            // Counted through the same helper the server validates with, so
            // the feedback here always matches what a save would allow.
            ...countRichText(JSON.stringify(editor.getJSON())),
          }
        : null,
  });

  const chars = state?.chars ?? 0;
  const lines = state?.lines ?? 0;
  const error = descriptionLimitError({ chars, lines });
  const noteClass = cn("text-[11px] leading-4", error ? "text-destructive" : "text-slate-400");

  return (
    <div>
      <div
        aria-invalid={error !== null}
        className={cn(
          "overflow-hidden rounded-lg border border-input bg-transparent text-base transition-colors md:text-sm",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          "[&_ul]:list-disc [&_ul]:pl-5",
          error && "border-destructive ring-3 ring-destructive/20",
        )}
      >
        <div className="flex items-center gap-0.5 border-b border-input px-1.5 py-1">
          <ToolbarButton
            label="Bold"
            active={state?.isBold}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold />
          </ToolbarButton>

          <ToolbarButton
            label="Italic"
            active={state?.isItalic}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </ToolbarButton>

          <ToolbarButton
            label="Bullet list"
            active={state?.isBulletList}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-slate-200" />

          <ToolbarButton
            label="Undo"
            disabled={!state?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 />
          </ToolbarButton>

          <ToolbarButton
            label="Redo"
            disabled={!state?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 />
          </ToolbarButton>
        </div>

        <EditorContent editor={editor} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p role={error ? "alert" : undefined} className={noteClass}>
          {error ?? "Bold, italic and bullet points only."}
        </p>

        <p className={noteClass}>
          {chars}/{DESCRIPTION_MAX_CHARS} characters · {lines}/{DESCRIPTION_MAX_LINES} lines
        </p>
      </div>
    </div>
  );
}
