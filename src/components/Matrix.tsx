import { useMemo, useState } from "react";
import { useStore } from "../store";
import { usePresence } from "../analysis";

/** Qui apparaît où : fiches en lignes, scènes en colonnes. */
export function Matrix() {
  const { select, setView, project } = useStore();
  const pres = usePresence();
  const [category, setCategory] = useState("");
  const [hideAbsent, setHideAbsent] = useState(false);

  const categories = useMemo(() => [...new Set(pres.fiches.map((f) => f.category).filter(Boolean))], [pres.fiches]);
  if (!project) return null;

  const rows = pres.fiches.filter((f) => (!category || f.category === category) && (!hideAbsent || (pres.counts.get(f.node.id)?.size ?? 0) > 0));

  // groupes de colonnes par chapitre
  const groups: { chapter: string; n: number }[] = [];
  pres.scenes.forEach((sc) => {
    const ch = pres.chapterOf.get(sc.id) ?? "";
    if (groups.length && groups[groups.length - 1].chapter === ch) groups[groups.length - 1].n++;
    else groups.push({ chapter: ch, n: 1 });
  });

  const open = (id: string) => { select(id); setView("editor"); };

  return (
    <div className="matrix">
      <div className="cork-head">
        <strong>Présence des personnages et des lieux</strong>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="check inline"><input type="checkbox" checked={hideAbsent} onChange={(e) => setHideAbsent(e.target.checked)} /> Masquer les fiches absentes du texte</label>
        <div className="spacer" />
        <span className="muted">★ = point de vue de la scène</span>
      </div>
      {!pres.ready && <p className="empty">Analyse du texte…</p>}
      {pres.ready && pres.scenes.length === 0 && <p className="empty">Aucune scène dans le manuscrit.</p>}
      {pres.ready && pres.fiches.length === 0 && <p className="empty">Crée des fiches (onglet « Fiches ») : leur nom est cherché automatiquement dans tes scènes.</p>}
      {pres.ready && pres.scenes.length > 0 && rows.length > 0 && (
        <div className="matrix-scroll">
          <table>
            <thead>
              <tr>
                <th className="corner" />
                {groups.map((g, i) => <th key={i} colSpan={g.n} className="chap" title={g.chapter}>{g.chapter || "—"}</th>)}
                <th className="tot">Total</th>
              </tr>
              <tr>
                <th className="corner" />
                {pres.scenes.map((sc, i) => (
                  <th key={sc.id} className="sc" title={sc.title} onClick={() => open(sc.id)}><span>{i + 1}</span></th>
                ))}
                <th className="tot" />
              </tr>
            </thead>
            <tbody>
              {rows.map((f, ri) => {
                const c = pres.counts.get(f.node.id)!;
                const total = [...c.values()].reduce((a, b) => a + b, 0);
                const showCat = ri === 0 || rows[ri - 1].category !== f.category;
                return [
                  showCat && f.category ? <tr key={"c" + f.category} className="cat"><td colSpan={pres.scenes.length + 2}>{f.category}</td></tr> : null,
                  <tr key={f.node.id}>
                    <th className="name" onClick={() => open(f.node.id)} title="Ouvrir la fiche">{f.node.title}</th>
                    {pres.scenes.map((sc) => {
                      const n = c.get(sc.id) ?? 0;
                      const pov = sc.pov === f.node.id;
                      return (
                        <td key={sc.id} className={n ? "present" : ""} style={n ? { background: `color-mix(in srgb, var(--accent) ${Math.min(90, 25 + n * 12)}%, transparent)` } : undefined} onClick={() => open(sc.id)} title={`${f.node.title} · ${sc.title}${n ? ` · ${n}×` : ""}`}>
                          {pov ? "★" : n || ""}
                        </td>
                      );
                    })}
                    <td className="tot">{total || "—"}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
