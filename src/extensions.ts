import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import Suggestion from "@tiptap/suggestion";
import { useStore } from "./store";
import { flatten } from "./tree";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Commentaire de relecture sur un passage. Stocké en HTML en ligne dans le Markdown. */
export const Comment = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-comment") ?? "",
        renderHTML: (a) => ({ "data-comment": a.text }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-comment]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "cm", title: HTMLAttributes["data-comment"] || "Commentaire" }, HTMLAttributes), 0];
  },
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: (_state: unknown, mark: { attrs: { text: string } }) => `<span data-comment="${esc(mark.attrs.text)}">`,
          close: "</span>",
          mixable: true,
          expelEnclosingWhitespace: true,
        },
        parse: {},
      },
    };
  },
});

/** Note de bas de page : appel numéroté dans le texte, contenu dans l'attribut. */
export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-footnote") ?? "",
        renderHTML: (a) => ({ "data-footnote": a.text }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-footnote]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ class: "fn", title: HTMLAttributes["data-footnote"] || "Note vide" }, HTMLAttributes)];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: { text: string } }) {
          state.write(`<span data-footnote="${esc(node.attrs.text)}"></span>`);
        },
        parse: {},
      },
    };
  },
});

/** Mode machine à écrire : garde la ligne courante vers le milieu de l'écran. */
export const Typewriter = Extension.create({
  name: "typewriter",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: () => ({
          update(view, prev) {
            if (!useStore.getState().typewriter || !view.hasFocus()) return;
            if (view.state.doc === prev.doc && view.state.selection.eq(prev.selection)) return;
            requestAnimationFrame(() => {
              const scroller = view.dom.closest(".page-scroll") as HTMLElement | null;
              if (!scroller) return;
              const caret = view.coordsAtPos(view.state.selection.head);
              const box = scroller.getBoundingClientRect();
              const delta = caret.top - (box.top + box.height * 0.45);
              if (Math.abs(delta) > 24) scroller.scrollBy({ top: delta, behavior: "auto" });
            });
          },
        }),
      }),
    ];
  },
});

/** Surlignage des répétitions (décorations pilotées par setRepetitions). */
const repKey = new PluginKey<DecorationSet>("repetitions");
export const RepetitionHighlight = Extension.create({
  name: "repetitionHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: repKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(repKey) as { from: number; to: number }[] | null | undefined;
            if (meta === undefined) return old.map(tr.mapping, tr.doc);
            if (!meta) return DecorationSet.empty;
            return DecorationSet.create(
              tr.doc,
              meta.filter((r) => r.to <= tr.doc.content.size).map((r) => Decoration.inline(r.from, r.to, { class: "rep" })),
            );
          },
        },
        props: { decorations: (state) => repKey.getState(state) },
      }),
    ];
  },
});

export function setRepetitions(
  editor: { state: { tr: import("@tiptap/pm/state").Transaction }; view: { dispatch: (tr: import("@tiptap/pm/state").Transaction) => void } },
  ranges: { from: number; to: number }[] | null,
) {
  editor.view.dispatch(editor.state.tr.setMeta(repKey, ranges));
}

/** @ : propose les fiches (personnages, lieux…) et insère leur nom. */
export const MentionSuggest = Extension.create({
  name: "mentionSuggest",
  addProseMirrorPlugins() {
    return [
      Suggestion<{ id: string; title: string; hint: string }>({
        editor: this.editor,
        char: "@",
        allowSpaces: true,
        items: ({ query }) => {
          const p = useStore.getState().project;
          if (!p) return [];
          const q = query.toLowerCase();
          const out: { id: string; title: string; hint: string }[] = [];
          const walk = (nodes: typeof p.notes, parent: string) =>
            nodes.forEach((n) => {
              if (n.kind === "folder") return walk(n.children, n.title);
              if (!q || [n.title, ...n.aliases].some((x) => x.toLowerCase().includes(q))) out.push({ id: n.id, title: n.title, hint: parent });
            });
          walk(p.notes, "");
          void flatten;
          return out.slice(0, 8);
        },
        command: ({ editor, range, props }) => {
          editor.chain().focus().insertContentAt(range, props.title + " ").run();
        },
        render: () => {
          let el: HTMLDivElement | null = null;
          let list: { id: string; title: string; hint: string }[] = [];
          let sel = 0;
          let run: (p: { id: string; title: string; hint: string }) => void = () => {};
          const draw = (rect: DOMRect | null) => {
            if (!el) return;
            el.innerHTML = "";
            list.forEach((it, i) => {
              const row = document.createElement("div");
              row.className = "mention-row" + (i === sel ? " on" : "");
              row.innerHTML = `<b></b><small></small>`;
              (row.children[0] as HTMLElement).textContent = it.title;
              (row.children[1] as HTMLElement).textContent = it.hint;
              row.onmousedown = (e) => { e.preventDefault(); run(it); };
              el!.appendChild(row);
            });
            el.style.display = list.length ? "block" : "none";
            if (rect) { el.style.left = rect.left + "px"; el.style.top = rect.bottom + 4 + "px"; }
          };
          return {
            onStart: (p) => {
              el = document.createElement("div");
              el.className = "mention-pop";
              document.body.appendChild(el);
              list = p.items; sel = 0; run = (it) => p.command(it);
              draw(p.clientRect?.() ?? null);
            },
            onUpdate: (p) => { list = p.items; sel = Math.min(sel, Math.max(0, list.length - 1)); run = (it) => p.command(it); draw(p.clientRect?.() ?? null); },
            onKeyDown: ({ event }) => {
              if (!list.length) return false;
              if (event.key === "ArrowDown") { sel = (sel + 1) % list.length; draw(null); return true; }
              if (event.key === "ArrowUp") { sel = (sel - 1 + list.length) % list.length; draw(null); return true; }
              if (event.key === "Enter" || event.key === "Tab") { run(list[sel]); return true; }
              return false;
            },
            onExit: () => { el?.remove(); el = null; },
          };
        },
      }),
    ];
  },
});
