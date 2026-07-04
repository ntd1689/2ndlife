"use client";
import { useRef, useState } from "react";
import MarkdownText from "./MarkdownText";

// Description input with lightweight formatting: toolbar buttons insert
// markdown around the current selection, and a Preview tab shows the result
// exactly as MarkdownText will render it on the listing page.

export default function DescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  function focusAndSelect(start: number, end: number) {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    });
  }

  function wrapSelection(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || "text";
    onChange(value.slice(0, s) + before + selected + after + value.slice(e));
    focusAndSelect(s + before.length, s + before.length + selected.length);
  }

  function prefixSelectedLines(prefix: (lineIndex: number) => string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const newlineAfter = value.indexOf("\n", e);
    const end = newlineAfter === -1 ? value.length : newlineAfter;
    const block = value.slice(start, end) || "List item";
    const prefixed = block.split("\n").map((line, i) => prefix(i) + line).join("\n");
    onChange(value.slice(0, start) + prefixed + value.slice(end));
    focusAndSelect(start, start + prefixed.length);
  }

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        <button type="button" className="md-btn" title="Bold" onClick={() => wrapSelection("**")}>
          <b>B</b>
        </button>
        <button type="button" className="md-btn" title="Italic" onClick={() => wrapSelection("*")}>
          <i>I</i>
        </button>
        <button type="button" className="md-btn" title="Bullet list" onClick={() => prefixSelectedLines(() => "- ")}>
          • List
        </button>
        <button type="button" className="md-btn" title="Numbered list" onClick={() => prefixSelectedLines((i) => `${i + 1}. `)}>
          1. List
        </button>
        <span className="md-tabs">
          <button
            type="button"
            className={`md-btn ${tab === "write" ? "active" : ""}`}
            onClick={() => setTab("write")}
          >
            Write
          </button>
          <button
            type="button"
            className={`md-btn ${tab === "preview" ? "active" : ""}`}
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
        </span>
      </div>

      {tab === "write" ? (
        <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={6} />
      ) : (
        <div className="md-preview">
          {value.trim() ? <MarkdownText text={value} className="description" /> : <p className="note">Nothing to preview yet.</p>}
        </div>
      )}
      <p className="note" style={{ margin: "6px 0 0" }}>
        Formatting: **bold**, *italic*, and lists starting with - or 1.
      </p>
    </div>
  );
}
