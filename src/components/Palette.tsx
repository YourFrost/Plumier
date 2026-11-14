import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { COMMANDS, keysOf, loadBindings, prettyKeys } from "../commands";
import { flatten } from "../tree";

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

interface Item { key: string; label: string; hint: string; run: () => void }

/** Palette de commandes (Ctrl+K) et ouverture rapide d'une scène ou fiche (Ctrl+P). */
export function Palette({ mode }: { mode: "palette" | "quickopen" }) {
  const { project, setModal, select, setView } = useStore();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const needle = norm(q.trim());
    const match = (s: string) => !needle || needle.split(/\s+/).every((w) => norm(s).includes(w));
    if (mode === "palette") {
      const b = loadBindings();
      return COMMANDS.filter((c) => match(c.label + " " + c.group)).map((c) => ({
        key: c.id,
        label: c.label,
        hint: prettyKeys(keysOf(c, b)),
        run: () => void c.run(),
      }));
    }
    if (!project) return [];
    const out: Item[] = [];
    const walk = (nodes: typeof project.notes, trail: string[], where: string) =>
      nodes.forEach((n) => {
        if (n.kind === "folder") return walk(n.children, [...trail, n.title], where);
        const path = [where, ...trail].join(" › ");
        if (match(n.title + " " + path + " " + n.aliases.join(" "))) {
          out.push({ key: n.id, label: n.title, hint: path, run: () => { setView("editor"); select(n.id); } });
        }
      });
    walk(project.manuscript, [], "Manuscrit");
    walk(project.notes, [], "Fiches");
    void flatten;
    return out.slice(0, 60);
  }, [q, mode, project, select, setView]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    (listRef.current?.children[sel] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (it?: Item) => {
    if (!it) return;
    setModal(null);
    setTimeout(it.run, 0);
  };

  return (
    <div className="modal-back" onClick={() => setModal(null)}>
      <div className="modal palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder={mode === "palette" ? "Tape une commande…" : "Ouvrir une scène ou une fiche…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); run(items[sel]); }
            else if (e.key === "Escape") setModal(null);
          }}
        />
        <div className="palette-list" ref={listRef}>
          {items.length === 0 && <p className="muted" style={{ padding: 12 }}>Aucun résultat.</p>}
          {items.map((it, i) => (
            <div key={it.key} className={`palette-row ${i === sel ? "on" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
              <span>{it.label}</span>
              <small>{it.hint}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
