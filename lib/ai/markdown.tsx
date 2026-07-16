import * as React from 'react';

/**
 * Some chat models wrap their whole reply in a fenced block
 * (```markdown … ``` / ```text … ```). Strip a single leading/trailing fence so
 * the literal backticks don't show up in the rendered report.
 */
export function stripFences(md: string): string {
  return md
    .replace(/^\s*```[a-zA-Z0-9]*\s*\n/i, '')
    .replace(/\n```\s*$/i, '')
    .trim();
}
/**
 * Minimal, dependency-free Markdown renderer (safe: builds React elements, no
 * HTML string injection). Handles what the report prompt produces: headings,
 * bold/italic, inline code, ordered/unordered lists, blockquotes, hr, paragraphs.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split inline code first so we don't format inside `...`.
  text.split(/(`[^`]+`)/g).forEach((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(
        <code key={`${keyPrefix}-c${i}`} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>,
      );
    } else {
      // Bold, then italic.
      part.split(/(\*\*[^*]+\*\*)/g).forEach((b, j) => {
        if (b.startsWith('**') && b.endsWith('**') && b.length > 4) {
          nodes.push(<strong key={`${keyPrefix}-b${i}-${j}`}>{b.slice(2, -2)}</strong>);
        } else {
          b.split(/(\*[^*]+\*)/g).forEach((it, k) => {
            if (it.startsWith('*') && it.endsWith('*') && it.length > 2) {
              nodes.push(<em key={`${keyPrefix}-i${i}-${j}-${k}`}>{it.slice(1, -1)}</em>);
            } else if (it) {
              nodes.push(<span key={`${keyPrefix}-t${i}-${j}-${k}`}>{it}</span>);
            }
          });
        }
      });
    }
  });
  return nodes;
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} className="my-4 border-border" />);
      i++;
      continue;
    }

    // Heading
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = h[1].length;
      const txt = h[2];
      if (level <= 2) {
        blocks.push(
          <p
            key={key++}
            className="mt-5 text-xl font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {renderInline(txt, `h${key}`)}
          </p>,
        );
      } else {
        blocks.push(
          <p key={key++} className="mt-4 text-sm font-semibold uppercase tracking-wide text-foreground/80">
            {renderInline(txt, `h${key}`)}
          </p>,
        );
      }
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="my-3 border-l-2 border-primary/40 pl-4 text-sm italic text-muted-foreground">
          {renderInline(buf.join(' '), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 ml-5 list-disc space-y-1 text-sm">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ul${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-2 ml-5 list-decimal space-y-1 text-sm">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ol${key}-${idx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph
    const buf = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|[-*]\s|\d+\.\s|>\s?|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i].trim())
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 text-sm leading-relaxed">
        {renderInline(buf.join(' '), `p${key}`)}
      </p>,
    );
  }

  return <div className={className}>{blocks}</div>;
}
