import type { TreeNode } from "./types";
import { storage } from "./storage";

export interface CompileOptions {
  /** Afficher le titre des scènes en sous-titre */
  sceneTitles: boolean;
  /** Séparateur entre scènes d'un même chapitre */
  separator: string;
  /** Exclure les nœuds à l'état « Idée » */
  skipIdeas: boolean;
}

/** Assemble tout le manuscrit en un seul document Markdown. */
export async function compileManuscript(dir: string, roots: TreeNode[], opt: CompileOptions): Promise<string> {
  const parts: string[] = [];

  async function walk(nodes: TreeNode[], depth: number) {
    let first = true;
    for (const n of nodes) {
      if (opt.skipIdeas && n.status === "idee") continue;
      if (n.kind === "folder") {
        parts.push(`${"#".repeat(Math.min(depth, 3))} ${n.title}\n`);
        await walk(n.children, depth + 1);
      } else {
        if (!first && !opt.sceneTitles && opt.separator) parts.push(`${opt.separator}\n`);
        if (opt.sceneTitles) parts.push(`${"#".repeat(Math.min(depth, 4))} ${n.title}\n`);
        const body = (await storage.readDoc(dir, n.id)).trim();
        if (body) parts.push(body + "\n");
        first = false;
      }
    }
  }
  await walk(roots, 1);
  return parts.join("\n");
}

const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/**
 * Prépare le Markdown pour l'export :
 *  - les commentaires de relecture ne sont jamais exportés (le texte commenté est conservé) ;
 *  - 'pandoc' : les notes de bas de page deviennent des notes Pandoc ^[...] (Word, EPUB, ODT…) ;
 *  - 'pdf' : les notes restent des <span> traités par la mise en page du PDF.
 */
export function finalizeMarkdown(md: string, mode: "pandoc" | "pdf"): string {
  // Dissoudre les commentaires (on garde le texte), même s'ils entourent une note de bas de page.
  let depth = 0;
  md = md.replace(/<span data-comment="[^"]*">|<span data-footnote="[^"]*"><\/span>|<\/span>/g, (tok) => {
    if (tok.startsWith("<span data-comment")) { depth++; return ""; }
    if (tok === "</span>") { if (depth > 0) { depth--; return ""; } return tok; }
    return tok; // note de bas de page : conservée
  });
  if (mode === "pandoc") {
    md = md.replace(/<span data-footnote="([^"]*)"><\/span>/g, (_m, t) => `^[${unesc(t).replace(/\]/g, "\\]")}]`);
  }
  return md;
}
