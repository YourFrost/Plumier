import { marked } from "marked";

export type PageFormat = "poche" | "A5" | "grand" | "A4" | "letter";

export interface PdfOptions {
  page: PageFormat;
  font: string;
  fontPt: number;
  line: number;
  marginMm: number;
  justify: boolean;
  hyphens: boolean;
  pageNumbers: boolean;
  titlePage: boolean;
  chapterNewPage: boolean;
}

export const PAGE_FORMATS: Record<PageFormat, { label: string; w: string; h: string }> = {
  poche: { label: "Poche (11 × 17,7 cm)", w: "110mm", h: "177mm" },
  A5: { label: "A5 (14,8 × 21 cm)", w: "148mm", h: "210mm" },
  grand: { label: "Grand format (14 × 21,5 cm)", w: "140mm", h: "215mm" },
  A4: { label: "A4 (21 × 29,7 cm)", w: "210mm", h: "297mm" },
  letter: { label: "Lettre US (8,5 × 11 po)", w: "8.5in", h: "11in" },
};

export const PDF_FONTS = [
  { label: "Garamond / Georgia", value: 'Garamond, "EB Garamond", Georgia, serif' },
  { label: "Palatino", value: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Sans-serif (Segoe UI)", value: '"Segoe UI", Arial, sans-serif' },
];

export const DEFAULT_PDF: PdfOptions = {
  page: "A5", font: PDF_FONTS[0].value, fontPt: 11.5, line: 1.45, marginMm: 18,
  justify: true, hyphens: true, pageNumbers: true, titlePage: true, chapterNewPage: true,
};

/** Markdown → HTML du livre. Les notes de bas de page sont numérotées et regroupées en fin de chapitre. */
export function buildBookHtml(md: string, title: string, author: string, opt: PdfOptions): string {
  const raw = marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
  const doc = new DOMParser().parseFromString(`<div id="r">${raw}</div>`, "text/html");
  const root = doc.getElementById("r")!;

  // Commentaires : on garde le texte
  root.querySelectorAll("span[data-comment]").forEach((s) => s.replaceWith(...Array.from(s.childNodes)));

  // Découpage en chapitres (titres de niveau 1) et notes par chapitre
  const chapters: HTMLElement[] = [];
  let cur = doc.createElement("section");
  cur.className = "chapter";
  Array.from(root.childNodes).forEach((n) => {
    if (n.nodeName === "H1" && cur.childNodes.length) {
      chapters.push(cur);
      cur = doc.createElement("section");
      cur.className = "chapter";
    }
    cur.appendChild(n);
  });
  chapters.push(cur);
  // Un chapitre sans aucun texte (titre seul) ne doit pas produire de page vide.
  const printable = chapters.filter((c) => Array.from(c.children).some((x) => x.tagName !== "H1") || chapters.length === 1);

  for (const ch of printable) {
    const notes: string[] = [];
    ch.querySelectorAll("span[data-footnote]").forEach((s) => {
      notes.push(s.getAttribute("data-footnote") ?? "");
      const sup = doc.createElement("sup");
      sup.className = "fnref";
      sup.textContent = String(notes.length);
      s.replaceWith(sup);
    });
    if (notes.length) {
      const box = doc.createElement("div");
      box.className = "notes";
      const ol = doc.createElement("ol");
      notes.forEach((t) => {
        const li = doc.createElement("li");
        li.textContent = t;
        ol.appendChild(li);
      });
      box.appendChild(ol);
      ch.appendChild(box);
    }
  }

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const titlePage = opt.titlePage
    ? `<section class="titlepage"><h1 class="bk-title">${esc(title)}</h1>${author ? `<p class="bk-author">${esc(author)}</p>` : ""}</section>`
    : "";
  return `<div class="book">${titlePage}${printable.map((c) => c.outerHTML).join("")}</div>`;
}

export function bookCss(opt: PdfOptions): string {
  const pg = PAGE_FORMATS[opt.page];
  return `
@page { size: ${pg.w} ${pg.h}; margin: ${opt.marginMm}mm ${opt.marginMm - 2}mm ${opt.marginMm + 2}mm;
  ${opt.pageNumbers ? `@bottom-center { content: counter(page); font: 9pt ${opt.font}; color: #555; }` : ""} }
@page titlepage { @bottom-center { content: none; } }
.pp-paper .book { font-family: ${opt.font}; font-size: ${opt.fontPt}pt; line-height: ${opt.line}; color: #111; text-align: ${opt.justify ? "justify" : "left"};
  ${opt.hyphens ? "hyphens: auto; -webkit-hyphens: auto;" : "hyphens: manual;"} }
.pp-paper .book *, .pp-paper .book { box-sizing: border-box; }
.pp-paper .book p { margin: 0; text-indent: 1.4em; orphans: 2; widows: 2; }
.pp-paper .book h1 + p, .pp-paper .book h2 + p, .pp-paper .book h3 + p, .pp-paper .book hr + p, .pp-paper .book blockquote + p { text-indent: 0; }
.pp-paper .book .chapter > :first-child + p { text-indent: 0; }
.pp-paper .book h1 { text-align: center; font-size: 1.7em; font-weight: 600; margin: 22% 0 1.4em; break-after: avoid; ${opt.chapterNewPage ? "break-before: page;" : "margin-top: 2.2em;"} }
.pp-paper .book .titlepage + .chapter h1, .pp-paper .book .chapter:first-of-type h1 { break-before: auto; }
.pp-paper .book h2 { text-align: center; font-size: 1.2em; font-weight: 600; margin: 2em 0 1em; break-after: avoid; }
.pp-paper .book h3 { font-size: 1.05em; margin: 1.4em 0 .6em; break-after: avoid; }
.pp-paper .book hr { border: 0; text-align: center; margin: 1.1em 0; height: 1em; }
.pp-paper .book hr::after { content: "*   *   *"; letter-spacing: .2em; }
.pp-paper .book blockquote { margin: .9em 1.6em; font-style: italic; }
.pp-paper .book ul, .pp-paper .book ol { margin: .6em 0; padding-left: 1.6em; }
.pp-paper .book .titlepage { page: titlepage; break-after: page; text-align: center; padding-top: 32%; }
.pp-paper .book .bk-title { font-size: 2.4em; margin: 0 0 1em; break-before: auto; }
.pp-paper .book .bk-author { text-indent: 0; font-size: 1.3em; letter-spacing: .08em; }
.pp-paper .book .fnref { font-size: .7em; vertical-align: super; line-height: 0; }
.pp-paper .book .notes { margin-top: 2.2em; padding-top: .6em; border-top: .5pt solid #888; font-size: .85em; line-height: 1.35; text-align: left; }
.pp-paper .book .notes ol { padding-left: 1.4em; margin: 0; }
/* aperçu à l'écran */
#print-root { position: fixed; inset: 0; z-index: 100; overflow: auto; background: #6b6b6b; }
#print-root .pp-bar { position: sticky; top: 0; z-index: 2; display: flex; gap: 10px; align-items: center; padding: 8px 16px; background: #222; color: #eee; font: 14px "Segoe UI", sans-serif; }
#print-root .pp-bar button { background: #444; color: #fff; border: 1px solid #666; border-radius: 6px; padding: 5px 14px; cursor: pointer; font: inherit; }
#print-root .pp-bar button.primary { background: #c9a24a; color: #1b1b1b; border-color: #c9a24a; }
#print-root .pp-bar span { flex: 1; color: #bbb; }
#print-root .pp-paper { width: ${pg.w}; margin: 24px auto; background: #fff; padding: ${opt.marginMm}mm ${opt.marginMm - 2}mm; box-shadow: 0 2px 14px rgba(0,0,0,.5); }
@media print {
  html.pp-open #root { display: none !important; }
  html.pp-open, html.pp-open body { overflow: visible !important; height: auto !important; background: #fff !important; }
  #print-root { position: static !important; overflow: visible !important; background: #fff !important; }
  #print-root .pp-bar { display: none !important; }
  #print-root .pp-paper { width: auto !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
}`;
}

/** Affiche le livre mis en page ; « Imprimer / PDF » ouvre la boîte d'impression (Enregistrer au format PDF). */
export function openPrintPreview(bookHtml: string, opt: PdfOptions, hint: string) {
  closePrintPreview();
  const style = document.createElement("style");
  style.id = "pp-style";
  style.textContent = bookCss(opt);
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "print-root";
  root.innerHTML = `<div class="pp-bar"><button id="pp-back">← Retour</button><span>${hint}</span><button id="pp-print" class="primary">🖨 Imprimer / Enregistrer en PDF</button></div><div class="pp-paper">${bookHtml}</div>`;
  document.body.appendChild(root);
  document.documentElement.classList.add("pp-open");
  root.querySelector<HTMLButtonElement>("#pp-back")!.onclick = closePrintPreview;
  root.querySelector<HTMLButtonElement>("#pp-print")!.onclick = () => window.print();
  window.addEventListener("keydown", onKey, true);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") closePrintPreview();
}

export function closePrintPreview() {
  document.getElementById("print-root")?.remove();
  document.getElementById("pp-style")?.remove();
  document.documentElement.classList.remove("pp-open");
  window.removeEventListener("keydown", onKey, true);
}
