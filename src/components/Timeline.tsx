import { useMemo, useState } from "react";
import { useStore } from "../store";
import { STATUSES, type TreeNode } from "../types";
import { flatten } from "../tree";
import { LabelChips } from "./Labels";

interface Row { n: TreeNode; chapter: string; idx: number; flashback: boolean }

const fmt = (d: string) => (d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "Sans date");

export function Timeline() {
  const { project, select, setView, updateNode, selectedId } = useStore();
  const [mode, setMode] = useState<"book" | "chrono">("chrono");
  const [filter, setFilter] = useState("");

  const rows = useMemo<Row[]>(() => {
    if (!project) return [];
    const out: Row[] = [];
    const walk = (nodes: TreeNode[], chapter: string) =>
      nodes.forEach((n) => (n.kind === "folder" ? walk(n.children, n.title) : out.push({ n, chapter, idx: out.length, flashback: false })));
    walk(project.manuscript, "");
    // détecte les retours en arrière : date antérieure à la dernière date vue dans l'ordre du livre
    let last = "";
    out.forEach((r) => {
      if (r.n.date) {
        if (last && r.n.date < last) r.flashback = true;
        else last = r.n.date;
      }
    });
    return out;
  }, [project]);

  if (!project) return null;
  let list = rows.filter((r) => !filter || r.n.labels.includes(filter));
  if (mode === "chrono") {
    list = [...list].sort((a, b) => {
      if (a.n.date && b.n.date) return a.n.date.localeCompare(b.n.date) || a.idx - b.idx;
      if (a.n.date) return -1;
      if (b.n.date) return 1;
      return a.idx - b.idx;
    });
  }
  const dated = rows.filter((r) => r.n.date).length;

  let prevDate: string | null = null;
  return (
    <div className="timeline">
      <div className="cork-head">
        <strong>Chronologie</strong>
        <div className="seg">
          <button className={mode === "chrono" ? "active" : ""} onClick={() => setMode("chrono")}>Ordre chronologique</button>
          <button className={mode === "book" ? "active" : ""} onClick={() => setMode("book")}>Ordre du livre</button>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Toutes les étiquettes</option>
          {project.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <div className="spacer" />
        <span className="muted">{dated}/{rows.length} scènes datées</span>
      </div>
      <div className="tl-body">
        {rows.length === 0 && <p className="empty">Aucune scène. Crée des scènes puis donne-leur une date.</p>}
        <div className="tl-line">
          {list.map((r) => {
            const head = mode === "chrono" && r.n.date !== prevDate;
            prevDate = r.n.date;
            const st = STATUSES.find((s) => s.value === r.n.status)!;
            return (
              <div key={r.n.id}>
                {head && <h4 className="tl-date">{fmt(r.n.date)}</h4>}
                <div className={`tl-item ${selectedId === r.n.id ? "selected" : ""}`} onClick={() => select(r.n.id)} onDoubleClick={() => { select(r.n.id); setView("editor"); }}>
                  <span className="tl-dot" style={{ background: st.color }} />
                  <div className="tl-main">
                    <div className="tl-title">
                      <b>{r.n.title}</b>
                      {r.chapter && <small> · {r.chapter}</small>}
                      {r.flashback && mode === "book" && <span className="flash" title="Se situe avant la scène précédente datée">↩ retour en arrière</span>}
                    </div>
                    {r.n.synopsis && <div className="muted tl-syn">{r.n.synopsis}</div>}
                    <LabelChips ids={r.n.labels} />
                  </div>
                  <div className="tl-edit" onClick={(e) => e.stopPropagation()}>
                    <input type="date" value={r.n.date} onChange={(e) => updateNode(r.n.id, { date: e.target.value })} />
                    <input placeholder="moment" value={r.n.moment} onChange={(e) => updateNode(r.n.id, { moment: e.target.value })} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {flatten(project.manuscript).length > 0 && dated === 0 && <p className="muted">Astuce : renseigne la date des scènes ici ou dans le panneau de droite pour voir l'histoire dans l'ordre chronologique.</p>}
      </div>
    </div>
  );
}
