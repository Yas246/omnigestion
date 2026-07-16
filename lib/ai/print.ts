/**
 * Print-to-PDF for the AI report. Opens a clean, print-styled window (company
 * header + period + rendered report) and triggers the browser print dialog,
 * where the user saves as PDF. Keeps the app shell out of the printout.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** ASCII slug for a sensible default PDF filename (no accents / spaces). */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function inlineHtml(text: string): string {
  // code, then bold, then italic
  let t = escapeHtml(text);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return t;
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push('<hr/>');
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = Math.min(h[1].length, 4);
      out.push(`<h${level}>${inlineHtml(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inlineHtml(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inlineHtml(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${inlineHtml(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
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
    out.push(`<p>${inlineHtml(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

export function printReport(opts: {
  companyName: string;
  periodLabel: string;
  contentMd: string;
}) {
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Rapport-${slug(opts.companyName)}-${slug(opts.periodLabel)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1c20; line-height: 1.55; }
  .doc-head { border-bottom: 2px solid #e4e6ea; padding-bottom: 12px; margin-bottom: 18px; }
  .doc-head h1 { font-size: 20px; margin: 0 0 4px; }
  .doc-head .meta { color: #6b7280; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
  h2 { font-size: 17px; margin: 22px 0 8px; }
  h3 { font-size: 14px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: .04em; color: #4b5563; }
  h4 { font-size: 13px; margin: 12px 0 4px; }
  p { margin: 6px 0; font-size: 13px; }
  ul, ol { margin: 6px 0 6px 20px; font-size: 13px; }
  li { margin: 3px 0; }
  blockquote { border-left: 3px solid #c7c9cf; margin: 10px 0; padding: 2px 12px; color: #4b5563; font-style: italic; }
  code { background: #f1f3f5; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
  hr { border: none; border-top: 1px solid #e4e6ea; margin: 16px 0; }
  strong { font-weight: 650; }
  .footer { margin-top: 26px; border-top: 1px solid #e4e6ea; padding-top: 8px; color: #9aa0a6; font-size: 11px; }
</style></head>
<body>
  <div class="doc-head">
    <h1>${escapeHtml(opts.companyName)} — Rapport de gestion</h1>
    <div class="meta">Période : ${escapeHtml(opts.periodLabel)} · Généré par Analyse IA (DeepSeek)</div>
  </div>
  ${markdownToHtml(opts.contentMd)}
  <div class="footer">Document généré par Omnigestion · Analyse IA. Les chiffres proviennent de vos données de gestion.</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) {
    alert('Veuillez autoriser les fenêtres pop-up pour générer le PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the new document a tick to lay out before printing.
  w.onload = () => {
    setTimeout(() => {
      w.focus();
      w.print();
    }, 250);
  };
  // Fallback if onload already fired/unsupported.
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* noop */
    }
  }, 800);
}
