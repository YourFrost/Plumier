import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { ficheList } from "../analysis";
import { RELATION_TYPES } from "../structures";

const W = 1000, H = 640;
const PALETTE = ["#4a90d9", "#d9534f", "#3fa56b", "#c9a24a", "#8e6bbf", "#e0763a", "#2aa7a0", "#b5476a"];
const colorOf = (type: string) => {
  let h = 0;
  for (const ch of type.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

interface P { x: number; y: number }

/** Placement par forces (déterministe) : les liés s'attirent, tous se repoussent. */
function layout(ids: string[], edges: [string, string][]): Record<string, P> {
  const pos: Record<string, P> = {};
  ids.forEach((id, i) => {
    const a = (i / Math.max(1, ids.length)) * Math.PI * 2;
    pos[id] = { x: W / 2 + Math.cos(a) * 220, y: H / 2 + Math.sin(a) * 200 };
  });
  for (let it = 0; it < 260; it++) {
    const f: Record<string, P> = Object.fromEntries(ids.map((i) => [i, { x: 0, y: 0 }]));
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]], b = pos[ids[j]];
        const dx = a.x - b.x || 0.01, dy = a.y - b.y || 0.01;
        const d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
        const rep = 26000 / d2;
        f[ids[i]].x += (dx / d) * rep; f[ids[i]].y += (dy / d) * rep;
        f[ids[j]].x -= (dx / d) * rep; f[ids[j]].y -= (dy / d) * rep;
      }
    for (const [s, t] of edges) {
      const a = pos[s], b = pos[t];
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const att = (d - 170) * 0.02;
      f[s].x += (dx / d) * att * 10; f[s].y += (dy / d) * att * 10;
      f[t].x -= (dx / d) * att * 10; f[t].y -= (dy / d) * att * 10;
    }
    for (const id of ids) {
      f[id].x += (W / 2 - pos[id].x) * 0.01; f[id].y += (H / 2 - pos[id].y) * 0.01;
      pos[id].x = Math.min(W - 60, Math.max(60, pos[id].x + Math.max(-12, Math.min(12, f[id].x * 0.08))));
      pos[id].y = Math.min(H - 40, Math.max(40, pos[id].y + Math.max(-12, Math.min(12, f[id].y * 0.08))));
    }
  }
  return pos;
}

export function Relations() {
  const { project, updateNode, select, setView, selectedId } = useStore();
  const fiches = useMemo(() => (project ? ficheList(project.notes) : []), [project]);
  const [showAll, setShowAll] = useState(false);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [moved, setMoved] = useState<Record<string, P>>({});
  const [form, setForm] = useState({ from: "", type: "Ami", to: "" });
  const svg = useRef<SVGSVGElement>(null);

  const edges = useMemo(
    () => fiches.flatMap((f) => f.node.relations.filter((r) => fiches.some((x) => x.node.id === r.target)).map((r) => ({ from: f.node.id, to: r.target, type: r.type }))),
    [fiches],
  );
  const connected = new Set(edges.flatMap((e) => [e.from, e.to]));
  const nodes = fiches.filter((f) => showAll || connected.has(f.node.id));
  const ids = nodes.map((n) => n.node.id);
  const sig = ids.join(",") + "|" + edges.map((e) => e.from + e.to).join(",");
  const base = useMemo(() => layout(ids, edges.map((e) => [e.from, e.to])), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setMoved({}), [sig]);
  const pos = (id: string): P => moved[id] ?? base[id] ?? { x: W / 2, y: H / 2 };

  if (!project) return null;
  const types = [...new Set(edges.map((e) => e.type))];
  const nameOf = (id: string) => fiches.find((f) => f.node.id === id)?.node.title ?? "?";

  const toSvg = (e: React.PointerEvent): P => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const add = () => {
    if (!form.from || !form.to || form.from === form.to) return;
    const src = fiches.find((f) => f.node.id === form.from)!.node;
    updateNode(src.id, { relations: [...src.relations, { target: form.to, type: form.type.trim() || "Lié" }] });
    setForm({ ...form, to: "" });
  };

  const pairCount = new Map<string, number>();

  return (
    <div className="relations">
      <div className="cork-head">
        <strong>Relations entre personnages</strong>
        <label className="check inline"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Afficher toutes les fiches</label>
        <div className="spacer" />
        <select value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>
          <option value="">De…</option>
          {fiches.map((f) => <option key={f.node.id} value={f.node.id}>{f.node.title}</option>)}
        </select>
        <input list="rel-types" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: 110 }} />
        <datalist id="rel-types">{RELATION_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        <select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>
          <option value="">vers…</option>
          {fiches.filter((f) => f.node.id !== form.from).map((f) => <option key={f.node.id} value={f.node.id}>{f.node.title}</option>)}
        </select>
        <button className="primary" disabled={!form.from || !form.to} onClick={add}>＋ Relier</button>
      </div>
      {nodes.length === 0 && <p className="empty">Aucune relation pour l'instant. Utilise la barre ci-dessus, ou le panneau de détails d'une fiche.</p>}
      <div className="graph-wrap">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="graph"
          onPointerMove={(e) => { if (drag) { const p = toSvg(e); setMoved((m) => ({ ...m, [drag.id]: { x: p.x - drag.dx, y: p.y - drag.dy } })); } }}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          <defs>
            {types.map((t) => (
              <marker key={t} id={"arr-" + types.indexOf(t)} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill={colorOf(t)} />
              </marker>
            ))}
          </defs>
          {edges.filter((e) => ids.includes(e.from) && ids.includes(e.to)).map((e, i) => {
            const a = pos(e.from), b = pos(e.to);
            const k = [e.from, e.to].sort().join("|");
            const idx = pairCount.get(k) ?? 0;
            pairCount.set(k, idx + 1);
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
            const off = (idx % 2 ? -1 : 1) * (18 + Math.floor(idx / 2) * 22) * (e.from < e.to ? 1 : -1);
            const cx = (a.x + b.x) / 2 + (-dy / d) * off, cy = (a.y + b.y) / 2 + (dx / d) * off;
            // raccourcit la fin pour que la flèche ne passe pas sous le nœud
            const ex = b.x - (dx / d) * 30, ey = b.y - (dy / d) * 30;
            const focusOn = !!selectedId && ids.includes(selectedId);
            const hot = selectedId === e.from || selectedId === e.to;
            return (
              <g key={i} opacity={focusOn && !hot ? 0.25 : 1}>
                <path d={`M${a.x} ${a.y} Q${cx} ${cy} ${ex} ${ey}`} stroke={colorOf(e.type)} strokeWidth={hot ? 3 : 2} fill="none" markerEnd={`url(#arr-${types.indexOf(e.type)})`} />
                <text x={(a.x + 2 * cx + ex) / 4 + 0} y={(a.y + 2 * cy + ey) / 4 - 4} textAnchor="middle" className="edge-label" fill={colorOf(e.type)}>{e.type}</text>
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = pos(n.node.id);
            const sel = selectedId === n.node.id;
            return (
              <g
                key={n.node.id}
                className="gnode"
                transform={`translate(${p.x} ${p.y})`}
                onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); const m = toSvg(e); setDrag({ id: n.node.id, dx: m.x - p.x, dy: m.y - p.y }); select(n.node.id); }}
                onDoubleClick={() => { select(n.node.id); setView("editor"); }}
              >
                <circle r={28} className={sel ? "sel" : ""} />
                <text y={5} textAnchor="middle" className="node-initial">{n.node.title.slice(0, 2).toUpperCase()}</text>
                <text y={46} textAnchor="middle" className="node-name">{n.node.title}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {types.length > 0 && (
        <div className="legend-row">{types.map((t) => <span key={t}><i style={{ background: colorOf(t) }} /> {t}</span>)}<span className="muted">Glisse les ronds pour les déplacer · double-clic pour ouvrir la fiche</span></div>
      )}
      {edges.length > 0 && (
        <details className="rel-list">
          <summary>Toutes les relations ({edges.length})</summary>
          {edges.map((e, i) => (
            <div key={i}>{nameOf(e.from)} <b style={{ color: colorOf(e.type) }}>{e.type}</b> → {nameOf(e.to)}
              <a title="Supprimer" onClick={() => { const src = fiches.find((f) => f.node.id === e.from)!.node; updateNode(src.id, { relations: src.relations.filter((r) => !(r.target === e.to && r.type === e.type)) }); }}> 🗑</a>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
