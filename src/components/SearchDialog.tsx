import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { storage } from "../storage";
import { flatten } from "../tree";
import { flushEditor } from "./Editor";

interface Hit { id: string; title: string; where: string; excerpt: string; }

export function SearchDialog({ onClose }: { onClose: () => void }) {
  const { project, dir, select, setView } = useStore();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!project || !dir || q.trim().length < 2) { setHits([]); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      await flushEditor();
      const needle = q.trim().toLowerCase();
      const out: Hit[] = [];
      const all = [
        ...flatten(project.manuscript).map((n) => ({ n, where: "Manuscrit" })),
        ...flatten(project.notes).map((n) => ({ n, where: "Fiches" })),
      ];
      for (const { n, where } of all) {
        const text = n.kind === "doc" ? await storage.readDoc(dir, n.id) : "";
        const hay = (n.title + "\n" + n.synopsis + "\n" + text).toLowerCase();
        const i = hay.indexOf(needle);
        if (i < 0) continue;
        const bodyIdx = text.toLowerCase().indexOf(needle);
        const excerpt = bodyIdx >= 0
          ? "…" + text.slice(Math.max(0, bodyIdx - 40), bodyIdx + needle.length + 60).replace(/\s+/g, " ") + "…"
          : n.synopsis || n.title;
        out.push({ id: n.id, title: n.title, where, excerpt });
        if (out.length >= 100) break;
      }
      if (my === seq.current) { setHits(out); setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, project, dir]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal search" onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Rechercher dans tout le projet…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="hits">
          {busy && <p className="muted">Recherche…</p>}
          {!busy && q.trim().length >= 2 && hits.length === 0 && <p className="muted">Aucun résultat.</p>}
          {hits.map((h) => (
            <a key={h.id} className="hit" onClick={() => { const n = flatten([...project!.manuscript, ...project!.notes]).find((x) => x.id === h.id); if (n?.kind === "doc") { select(h.id); setView("editor"); } onClose(); }}>
              <b>{h.title}</b> <small>{h.where}</small>
              <div>{h.excerpt}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
