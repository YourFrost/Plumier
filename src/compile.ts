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
