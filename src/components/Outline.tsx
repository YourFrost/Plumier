import { useStore } from "../store";
import { STATUSES, type Status, type TreeNode } from "../types";
import { totalWords } from "../tree";

export function Outline() {
  const { project, section, select, setView, updateNode, selectedId } = useStore();
  if (!project) return null;

  const rows: { n: TreeNode; depth: number }[] = [];
  const walk = (nodes: TreeNode[], depth: number) =>
    nodes.forEach((n) => {
      rows.push({ n, depth });
      walk(n.children, depth + 1);
    });
  walk(project[section], 0);

  return (
    <div className="outline">
      <table>
        <thead>
          <tr>
            <th style={{ width: "26%" }}>Titre</th>
            <th>Résumé</th>
            <th style={{ width: 120 }}>Statut</th>
            <th style={{ width: 90, textAlign: "right" }}>Mots</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ n, depth }) => (
            <tr key={n.id} className={`${n.kind} ${selectedId === n.id ? "selected" : ""}`} onClick={() => n.kind === "doc" && select(n.id)}>
              <td style={{ paddingLeft: 10 + depth * 18 }}>
                <span>{n.kind === "folder" ? "📁 " : ""}</span>
                <a
                  onDoubleClick={() => {
                    if (n.kind === "doc") { select(n.id); setView("editor"); }
                  }}
                >
                  <input value={n.title} onChange={(e) => updateNode(n.id, { title: e.target.value })} />
                </a>
              </td>
              <td>
                <textarea rows={1} value={n.synopsis} placeholder="—" onChange={(e) => updateNode(n.id, { synopsis: e.target.value })} />
              </td>
              <td>
                <select value={n.status} onChange={(e) => updateNode(n.id, { status: e.target.value as Status })}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </td>
              <td style={{ textAlign: "right" }}>{totalWords(n).toLocaleString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
