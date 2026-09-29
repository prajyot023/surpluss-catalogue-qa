import { Fragment } from "react";
import { parseRichText, type RichTextBlock, type RichTextInline } from "@/lib/rich-text";

function Inline({ nodes }: { nodes: RichTextInline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "hardBreak") return <br key={index} />;

        let content: React.ReactNode = node.text;

        if (node.marks?.some((mark) => mark.type === "italic")) content = <em>{content}</em>;
        if (node.marks?.some((mark) => mark.type === "bold")) content = <strong>{content}</strong>;

        return <Fragment key={index}>{content}</Fragment>;
      })}
    </>
  );
}

function Blocks({ blocks }: { blocks: RichTextBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "bulletList") {
          const items = block.content ?? [];

          if (!items.length) return null;

          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Blocks blocks={item.content ?? []} />
                </li>
              ))}
            </ul>
          );
        }

        const nodes = block.content ?? [];

        if (!nodes.length) {
          return (
            <p key={index}>
              <br />
            </p>
          );
        }

        return (
          <p key={index}>
            <Inline nodes={nodes} />
          </p>
        );
      })}
    </>
  );
}

export function RichTextContent({ value }: { value: string }) {
  const doc = parseRichText(value);

  if (!doc) return <p>{value}</p>;

  return <Blocks blocks={doc.content ?? []} />;
}
