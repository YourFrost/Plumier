import { useStore } from "../store";
import { STATUSES, type TreeNode } from "../types";
import { dayKey, flatten, sectionWords, streakOf, today, totalWords } from "../tree";

const nf = (n: number) => Math.round(n).toLocaleString("fr-FR");

export function Stats() {
  const project = useStore((s) => s.project);
  if (!project) return null;

  const total = sectionWords(project.manuscript);
  const daily = project.daily;

  // 30 derniers jours
  const days: { key: string; v: number; label: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: dayKey(d), v: daily[dayKey(d)] ?? 0, label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) });
  }
  const max = Math.max(project.goals.daily, ...days.map((d) => d.v), 1);
  const last7 = days.slice(-7).reduce((s, d) => s + d.v, 0);
  const activeDays = Object.values(daily).filter((v) => v > 0).length;
  const best = Math.max(0, ...Object.values(daily));
  const avgActive = activeDays ? Object.values(daily).reduce((s, v) => s + v, 0) / activeDays : 0;

  const streak = streakOf(daily);

  // projection vers la date limite
  const { total: goal, deadline } = project.goals;
  let projection: string | null = null;
  if (goal > 0) {
    const left = Math.max(0, goal - total);
    if (left === 0) projection = "🎉 Objectif atteint !";
    else if (deadline) {
      const daysLeft = Math.ceil((new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86400000);
      projection = daysLeft > 0
        ? `Il reste ${nf(left)} mots pour ${daysLeft} jour${daysLeft > 1 ? "s" : ""} : environ ${nf(left / daysLeft)} mots par jour.`
        : `La date limite est dépassée, il reste ${nf(left)} mots.`;
    } else if (avgActive > 0) {
      projection = `Au rythme moyen de ${nf(avgActive)} mots par jour d'écriture, il faudra environ ${Math.ceil(left / avgActive)} jours d'écriture.`;
    }
  }

  // répartition par statut (scènes du manuscrit)
  const scenes = flatten(project.manuscript).filter((n) => n.kind === "doc");
  const byStatus = STATUSES.map((s) => ({ ...s, count: scenes.filter((n) => n.status === s.value).length, words: scenes.filter((n) => n.status === s.value).reduce((a, n) => a + n.words, 0) }));

  // mots par chapitre (dossiers de premier niveau)
  const chapters: TreeNode[] = project.manuscript;
  const maxCh = Math.max(1, ...chapters.map(totalWords));

  const W = 720, H = 180, bw = W / days.length;
  const goalY = H - (project.goals.daily / max) * H;

  return (
    <div className="stats">
      <div className="tiles">
        <Tile label="Mots du livre" value={nf(total)} sub={goal ? `${Math.min(100, Math.round((total / goal) * 100))} % de ${nf(goal)}` : ""} />
        <Tile label="Aujourd'hui" value={nf(daily[today()] ?? 0)} sub={`objectif ${nf(project.goals.daily)}`} />
        <Tile label="7 derniers jours" value={nf(last7)} sub={`${nf(last7 / 7)} / jour`} />
        <Tile label="Série en cours" value={`${streak} j`} sub={`${activeDays} jour${activeDays > 1 ? "s" : ""} d'écriture au total`} />
        <Tile label="Meilleur jour" value={nf(best)} sub="mots" />
        <Tile label="Scènes" value={String(scenes.length)} sub={`${nf(scenes.length ? total / scenes.length : 0)} mots en moyenne`} />
      </div>
      {projection && <p className="projection">{projection}</p>}

      <h3>30 derniers jours</h3>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="chart" role="img" aria-label="Mots écrits par jour sur les 30 derniers jours">
        {days.map((d, i) => {
          const h = (d.v / max) * H;
          return (
            <g key={d.key}>
              <rect x={i * bw + 2} y={H - h} width={bw - 4} height={Math.max(h, d.v ? 1 : 0)} rx={2} className={d.v >= project.goals.daily ? "bar-hit" : "bar-day"}>
                <title>{`${d.label} : ${nf(d.v)} mots`}</title>
              </rect>
              {(i % 5 === 0 || i === days.length - 1) && <text x={i * bw + bw / 2} y={H + 15} textAnchor={i === days.length - 1 ? "end" : i === 0 ? "start" : "middle"} className="axis">{d.label}</text>}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={goalY} y2={goalY} className="goal-line-svg" />
        <text x={W} y={goalY - 4} textAnchor="end" className="axis">objectif {nf(project.goals.daily)}</text>
      </svg>

      <div className="stat-cols">
        <div>
          <h3>Avancement des scènes</h3>
          <div className="stack">
            {byStatus.map((s) => s.count > 0 && <div key={s.value} style={{ flex: s.count, background: s.color }} title={`${s.label} : ${s.count}`} />)}
          </div>
          <ul className="legend">
            {byStatus.map((s) => (
              <li key={s.value}><span className="ldot" style={{ background: s.color }} /> {s.label} <b>{s.count}</b> <small>{nf(s.words)} mots</small></li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Mots par partie</h3>
          {chapters.length === 0 && <p className="muted">Rien pour l'instant.</p>}
          {chapters.map((c) => (
            <div key={c.id} className="hbar">
              <span>{c.title}</span>
              <div><i style={{ width: (totalWords(c) / maxCh) * 100 + "%" }} /></div>
              <b>{nf(totalWords(c))}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}
