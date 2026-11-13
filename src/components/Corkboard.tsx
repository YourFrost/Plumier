import { useState } from "react";
import { useStore } from "../store";
import { STATUSES, type Status } from "../types";
import { find, findParent, totalWords } from "../tree";
import { LabelChips } from "./Labels";

export function Corkboard() {
  const { project, section, selectedId, select, setView, addNode, moveNode, updateNode } = useStore();
  const [scopeId, setScopeId] = useState<string | null>(() => {
    // on ouvre le tableau sur le dossier de la scène en cours
    const st = useStore.getState();
    if (!st.project || !st.selectedId) return null;
    return findParent(st.project[st.section], st.selectedId)?.id ?? null;
  });
  const [filter, setFilter] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  if (!project) return null;

  const roots = project[section];
  const scope = scopeId ? find(roots, scopeId) : null;
  const effectiveScope = scope && scope.kind === "folder" ? scope : null;
  const all = effectiveScope ? effectiveScope.children : roots;
  const cards = filter ? all.filter((n) => n.labels.includes(filter)) : all;

  // fil d'Ariane
  const crumbs: { id: string | null; title: string }[] = [{ id: null, title: section === "manuscript" ? "Manuscrit" : "Fiches" }];
  if (effectiveScope) {
    const chain: typeof crumbs = [];
    let cur: typeof effectiveScope | null | undefined = effectiveScope;
    while (cur) {
      chain.unshift({ id: cur.id, title: cur.title });
      cur = findParent(roots, cur.id);
    }
    crumbs.push(...chain);
  }

  const dropOn = (targetIndex: number) => {
    if (dragId) moveNode(dragId, effectiveScope?.id ?? null, targetIndex);
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="corkboard">
      <div className="cork-head">
        <div className="crumbs">
          {crumbs.map((c, i) => (
            <span key={c.id ?? "root"}>
              {i > 0 && " › "}
              <a onClick={() => setScopeId(c.id)}>{c.title}</a>
            </span>
          ))}
        </div>
        <div className="spacer" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} title="Filtrer par étiquette">
          <option value="">Toutes les étiquettes</option>
          {project.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button onClick={() => addNode("doc", effectiveScope?.id ?? null)}>＋ {section === "manuscript" ? "Scène" : "Fiche"}</button>
        <button onClick={() => addNode("folder", effectiveScope?.id ?? null)}>＋ Dossier</button>
      </div>
      <div className="cork-grid">
        {cards.length === 0 && <p className="empty">Aucune carte ici. Ajoute une scène ou un dossier.</p>}
        {cards.map((n, i) => {
          const st = STATUSES.find((s) => s.value === n.status)!;
          return (
            <div
              key={n.id}
              className={`card ${n.kind} ${selectedId === n.id ? "selected" : ""} ${overId === n.id ? "over" : ""} ${dragId === n.id ? "dragging" : ""}`}
              style={{ borderTopColor: st.color }}
              draggable={!filter}
              onDragStart={() => setDragId(n.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => { if (dragId && dragId !== n.id) { e.preventDefault(); setOverId(n.id); } }}
              onDrop={(e) => { e.preventDefault(); dropOn(i); }}
              onClick={() => n.kind === "doc" && select(n.id)}
              onDoubleClick={() => {
                if (n.kind === "folder") setScopeId(n.id);
                else { select(n.id); setView("editor"); }
              }}
            >
              <div className="card-top">
                <span>{n.kind === "folder" ? "📁" : "📄"}</span>
                <input value={n.title} onChange={(e) => updateNode(n.id, { title: e.target.value })} onClick={(e) => e.stopPropagation()} />
              </div>
              <textarea
                placeholder="Résumé de la scène…"
                value={n.synopsis}
                onChange={(e) => updateNode(n.id, { synopsis: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
              <LabelChips ids={n.labels} />
              <div className="card-foot">
                <select value={n.status} onChange={(e) => updateNode(n.id, { status: e.target.value as Status })} onClick={(e) => e.stopPropagation()}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <span>{totalWords(n).toLocaleString("fr-FR")} mots</span>
              </div>
            </div>
          );
        })}
        {cards.length > 0 && !filter && (
          <div
            className={`card-end ${overId === "__end" ? "over" : ""}`}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId("__end"); } }}
            onDrop={(e) => { e.preventDefault(); dropOn(cards.length); }}
          >
            Déposer ici pour mettre en dernier
          </div>
        )}
      </div>
    </div>
  );
}
