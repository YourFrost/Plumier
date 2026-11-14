import type { Editor } from "@tiptap/react";

export interface Block { text: string; pos: number }

/** Blocs de texte du document avec la position ProseMirror de leur début. */
export function blocksOf(editor: Editor): Block[] {
  const out: Block[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock) {
      out.push({ text: node.textBetween(0, node.content.size, "\n", "\n"), pos: pos + 1 });
      return false;
    }
  });
  return out;
}
