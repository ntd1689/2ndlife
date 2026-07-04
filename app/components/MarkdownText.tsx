import React from "react";

// Renders the simple markdown subset used in listing descriptions:
// **bold**, *italic* / _italic_, [links](https://…), bullet and numbered
// lists. Output is built as React elements — raw HTML is never injected.

const INLINE = /(\*\*(.+?)\*\*|\*([^*\n]+?)\*|_([^_\n]+?)_|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\))/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const key = `${keyPrefix}.${i++}`;
    if (match[2] !== undefined) {
      nodes.push(<strong key={key}>{renderInline(match[2], key)}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<em key={key}>{renderInline(match[3], key)}</em>);
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{renderInline(match[4], key)}</em>);
    } else {
      nodes.push(
        <a key={key} href={match[6]} target="_blank" rel="noreferrer">
          {match[5]}
        </a>
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export default function MarkdownText({ text, className }: { text: string; className?: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let b = 0;

  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }

    if (BULLET.test(lines[i]) || NUMBERED.test(lines[i])) {
      const ordered = NUMBERED.test(lines[i]);
      const marker = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(lines[i].replace(marker, ""));
        i++;
      }
      const key = `b${b++}`;
      const children = items.map((item, j) => <li key={j}>{renderInline(item, `${key}.${j}`)}</li>);
      blocks.push(ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    const key = `b${b++}`;
    blocks.push(
      <p key={key}>
        {para.flatMap((line, j) => {
          const rendered = renderInline(line, `${key}.${j}`);
          return j === 0 ? rendered : [<br key={`${key}.br${j}`} />, ...rendered];
        })}
      </p>
    );
  }

  return <div className={className}>{blocks}</div>;
}
