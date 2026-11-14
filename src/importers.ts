import mammoth from "mammoth/mammoth.browser";
import TurndownService from "turndown";
import type { TreeNode } from "./types";
import { countWords, newNode } from "./tree";

export interface ImportFile { name: string; bytes?: Uint8Array; text?: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Convertit un fichier .docx / .md / .txt en Markdown. Les notes de bas de page Word deviennent des notes Plumier. */
export async function fileToMarkdown(f: ImportFile): Promise<string> {
  if (f.text !== undefined) return f.text.replace(/\r\n/g, "\n");
  if (!f.bytes) return "";
  const buf = f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer;
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: buf },
    { convertImage: mammoth.images.imgElement(() => ({ src: "" })) }, // pas d'images : trop lourdes
  );
  const doc = new DOMParser().parseFromString(value, "text/html");
  doc.querySelectorAll("img").forEach((i) => i.remove());

  // Notes de bas de page : <sup><a href="#footnote-N"> ... et <li id="footnote-N">
  const notes = new Map<string, string>();
  doc.querySelectorAll('li[id^="footnote-"]').forEach((li) => {
    li.querySelectorAll('a[href^="#footnote-ref"]').forEach((a) => a.remove());
    notes.set(li.id, (li.textContent ?? "").replace(/\s+/g, " ").trim());
  });
  const tokens: string[] = [];
  doc.querySelectorAll('sup a[href^="#footnote-"]').forEach((a) => {
    const text = notes.get((a.getAttribute("href") ?? "").slice(1)) ?? "";
    const sup = a.closest("sup") ?? a;
    sup.replaceWith(doc.createTextNode(`⟦FN${tokens.length}⟧`));
    tokens.push(text);
  });
  doc.querySelectorAll('ol:has(li[id^="footnote-"])').forEach((ol) => ol.remove());

  const td = new TurndownService({ headingStyle: "atx", emDelimiter: "*", strongDelimiter: "**", bulletListMarker: "-", hr: "* * *" });
  let md = td.turndown(doc.body.innerHTML);
  md = md.replace(/⟦FN(\d+)⟧/g, (_m, i) => `<span data-footnote="${esc(tokens[+i] ?? "")}"></span>`);
  return md.replace(/\n{3,}/g, "\n\n").trim();
}

export interface Chunk { level: number; title: string; body: string }

/** Titres Markdown (hors blocs de code) : niveau → nombre. */
export function headingCounts(md: string): Record<number, number> {
  const out: Record<number, number> = {};
  let fence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) fence = !fence;
    if (fence) continue;
    const m = /^(#{1,6})\s+\S/.exec(line);
    if (m) out[m[1].length] = (out[m[1].length] ?? 0) + 1;
  }
  return out;
}

/** Niveau de découpage conseillé : le plus profond ayant au moins 2 titres, en commençant par les chapitres. */
export function suggestLevel(counts: Record<number, number>): number {
  if ((counts[2] ?? 0) >= 2 && (counts[1] ?? 0) >= 1) return 2;
  if ((counts[1] ?? 0) >= 2) return 1;
  if ((counts[2] ?? 0) >= 2) return 2;
  return 0;
}

/** Transforme un Markdown en arbre : titres de niveau < L → dossiers, niveau L → scènes. */
export function markdownToTree(md: string, level: number, fallbackTitle: string): { nodes: TreeNode[]; bodies: Map<string, string> } {
  const bodies = new Map<string, string>();
  const make = (title: string, body: string): TreeNode => {
    const n = newNode("doc", title || "Sans titre");
    const content = body.trim();
    n.words = countWords(content);
    bodies.set(n.id, content);
    return n;
  };
  if (level <= 0) return { nodes: [make(fallbackTitle, md)], bodies };

  // découpage en sections
  const sections: { level: number; title: string; lines: string[] }[] = [{ level: 0, title: "", lines: [] }];
  let fence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) fence = !fence;
    const m = !fence ? /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line) : null;
    if (m && m[1].length <= level) sections.push({ level: m[1].length, title: m[2], lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }

  const root: TreeNode[] = [];
  const stack: { level: number; node: TreeNode }[] = [];
  const push = (n: TreeNode, lvl: number) => {
    while (stack.length && stack[stack.length - 1].level >= lvl) stack.pop();
    (stack.length ? stack[stack.length - 1].node.children : root).push(n);
  };
  const first = sections[0];
  if (first.lines.join("").trim()) root.push(make("Début", first.lines.join("\n")));
  sections.slice(1).forEach((sec, i, all) => {
    const body = sec.lines.join("\n");
    if (sec.level < level) {
      const folder = newNode("folder", sec.title);
      push(folder, sec.level);
      stack.push({ level: sec.level, node: folder });
      if (body.trim()) folder.children.push(make("Introduction", body));
    } else {
      push(make(sec.title, body), sec.level);
    }
    void all; void i;
  });
  return { nodes: root, bodies };
}
