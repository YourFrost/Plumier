import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

const NBSP = " "; // espace insécable
const NNBSP = " "; // espace fine insécable

const KEY = "plumier-typo";
export const typoEnabled = () => {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
};
export const setTypoEnabled = (v: boolean) => {
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
};

/**
 * Typographie française à la frappe :
 *  - « guillemets » avec espaces insécables
 *  - espace fine insécable avant ? ! ; et insécable avant :
 *  - apostrophe courbe ’ et points de suspension …
 * S'active/désactive avec setTypoEnabled (pris en compte immédiatement).
 */
export const FrenchTypography = Extension.create({
  name: "frenchTypography",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            if (!typoEnabled() || text.length !== 1) return false;
            const { state } = view;
            const $from = state.doc.resolve(from);
            if ($from.parent.type.spec.code) return false;
            const off = $from.parentOffset;
            const before = off > 0 ? $from.parent.textBetween(off - 1, off, undefined, "\n") : "";
            const insert = (s: string, start = from) => {
              view.dispatch(state.tr.insertText(s, start, to));
              return true;
            };

            if (text === '"') {
              const opening = off === 0 || /[\s  (\[—–-]/.test(before);
              if (opening) return insert("«" + NBSP);
              return insert(before === NBSP || before === NNBSP ? "»" : NBSP + "»");
            }
            if (text === "'") return insert("’");
            if (text === "." && off >= 2 && $from.parent.textBetween(off - 2, off) === "..") {
              return insert("…", from - 2);
            }
            if ("?!;:".includes(text) && off > 0) {
              if (before === " ") {
                // remplace l'espace ordinaire par l'espace insécable adaptée
                return insert((text === ":" ? NBSP : NNBSP) + text, from - 1);
              }
              if (/[\p{L}»"')\]…%]/u.test(before) || (/\p{N}/u.test(before) && text !== ":")) {
                if (text === ":" && /(https?|ftp|mailto|file)$/i.test($from.parent.textBetween(Math.max(0, off - 8), off))) return false;
                return insert((text === ":" ? NBSP : NNBSP) + text);
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
