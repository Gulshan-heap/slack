import Quill from "quill";
import { useEffect, useRef, useState } from "react";

import { registerMentionFormat } from "@/lib/quill-mention";

registerMentionFormat();

interface RendererProps {
  value: string;
};

const Renderer = ({ value }: RendererProps) => {
  const [isEmpty, setIsEmpty] = useState(false);
  const rendererRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rendererRef.current) return;

    const container = rendererRef.current;

    const quill = new Quill(document.createElement("div"), {
      theme: "snow",
    });

    quill.enable(false);

    let contents;

    try {
      contents = JSON.parse(value);
    } catch (err) {
      console.warn("⚠️ Invalid Quill JSON, falling back to plain text:", value);

      // Fallback: treat value as plain text
      contents = {
        ops: [{ insert: value + "\n" }],
      };
    }

    quill.setContents(contents);

    const isEmpty = quill.getText().replace(/<(.|\n)*?>/g, "").trim().length === 0;
    setIsEmpty(isEmpty);

    container.innerHTML = quill.root.innerHTML;

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [value]);

  if (isEmpty) return null;

  // The `ql-snow` wrapper matters: quill.snow.css scopes headings, quotes,
  // code blocks and links under `.ql-snow .ql-editor`, so without it a
  // rendered message loses the formatting the composer showed.
  return (
    <div className="ql-snow">
      <div ref={rendererRef} className="ql-editor ql-renderer" />
    </div>
  );
};

export default Renderer;
