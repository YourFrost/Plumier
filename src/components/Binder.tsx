import { useState } from "react";
import { useStore } from "../store";
import { STATUSES, type TreeNode } from "../types";
import { find, findParent, sectionWords, totalWords } from "../tree";
import { LabelDots } from "./Labels";

type Drop = { id: string; pos: "before" | "after" | "inside" } | null;

export function Binder() {
  const { project, section, setSection, selectedId, select, addNode, moveNode } = useStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [editing, setEditing] = useState<string | null>(null);

  if (!project) return null;
  const roots = project[section];

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectedFolder = () => {
    const n = selectedId ? find(roots, selectedId) : undefined;
    if (!n) return null;
    return n.kind === "folder" ? n.id : (findParent(roots, n.id)?.id ?? null);
  };

  const onDrop = () => {
    if (!dragId || !drop) return;
    const target = find(roots, drop.id);
    if (!target) return;
    if (drop.pos === "inside" && target.kind === "folder") {
      moveNode(dragId, target.id, target.children.length);
    } else {
      const parent = findParent(roots, target.id) ?? null;
      const siblings = parent ? parent.children : roots;
      const i = siblings.findIndex((n) => n.id === target.id);
      moveNode(dragId, parent?.id ?? null, drop.pos === "before" ? i : i + 1);
    }
    setDragId(null);
    setDrop(null);
  };

  const renderNode = (n: TreeNode, depth: number) => {
    const open = !collapsed.has(n.id);
    const status = STATUSES.find((s) => s.value === n.status)!;
    const cls = [
      "row",
      selectedId === n.id ? "selected" : "",
      drop?.id === n.id ? `drop-${drop.pos}` : "",
      dragId === n.id ? "dragging" : "",
    ].join(" ");
    return (
      <div key={n.id}>
        <div
          className={cls}
          style={{ paddingLeft: 8 + depth * 16 }}
          draggable={editing !== n.id}
          onDragStart={(e) => {
            setDragId(n.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", n.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setDrop(null);
          }}
          onDragOver={(e) => {
            if (!dragId || dragId === n.id) return;
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            const y = (e.clientY - r.top) / r.height;
            const pos = n.kind === "folder" && y > 0.25 && y < 0.75 ? "inside" : y < 0.5 ? "before" : "after";
            if (drop?.id !== n.id || drop.pos !== pos) setDrop({ id: n.id, pos });
          }}
          onDrop={(e) => {
            e.preventDefault();
            onDrop();
          }}
          onClick={() => {
            if (n.kind === "doc") return select(n.id);
            // dossier : un clic le sélectionne (cible des ajouts) et le déplie ; un clic de plus le replie
            if (!open) { toggle(n.id); select(n.id); }
            else if (selectedId === n.id) toggle(n.id);
            else select(n.id);
          }}
          onDoubleClick={() => setEditing(n.id)}
        >
          <span className="twisty" onClick={(e) => { e.stopPropagation(); if (n.kind === "folder") toggle(n.id); }}>
            {n.kind === "folder" ? (open ? "▾" : "▸") : ""}
          </span>
          <span className="icon">{n.kind === "folder" ? "📁" : "📄"}</span>
          {editing === n.id ? (
            <input
              className="rename"
              autoFocus
              defaultValue={n.title}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                useStore.getState().updateNode(n.id, { title: e.target.value.trim() || n.title });
                setEditing(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditing(null);
              }}
            />
          ) : (
            <span className="title">{n.title}</span>
          )}
          <LabelDots ids={n.labels} />
          {n.kind === "doc" && section === "manuscript" && <span className="dot" title={status.label} style={{ background: status.color }} />}
          <span className="count">{n.kind === "folder" ? totalWords(n) || "" : n.words || ""}</span>
          <span className="actions" onClick={(e) => e.stopPropagation()}>
            {n.kind === "folder" && (
              <button title="Ajouter une scène ici" onClick={() => { setCollapsed((c) => { const x = new Set(c); x.delete(n.id); return x; }); addNode("doc", n.id); }}>＋</button>
            )}
            <button title="Renommer" onClick={() => setEditing(n.id)}>✎</button>
            <button
              title="Supprimer"
              onClick={() => {
                const what = n.kind === "folder" ? `le dossier « ${n.title} » et tout son contenu` : `« ${n.title} »`;
                if (confirm(`Supprimer ${what} ? Cette action est définitive.`)) useStore.getState().deleteNode(n.id);
              }}
            >
              🗑
            </button>
          </span>
        </div>
        {n.kind === "folder" && open && n.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="binder">
      <div className="tabs">
        <button className={section === "manuscript" ? "active" : ""} onClick={() => setSection("manuscript")}>
          Manuscrit
        </button>
        <button className={section === "notes" ? "active" : ""} onClick={() => setSection("notes")}>
          Fiches
        </button>
      </div>
      <div className="binder-tools">
        <button onClick={() => addNode("doc", selectedFolder())}>＋ {section === "manuscript" ? "Scène" : "Fiche"}</button>
        <button onClick={() => addNode("folder", selectedFolder())}>＋ Dossier</button>
      </div>
      <div
        className="tree"
        onDragOver={(e) => dragId && e.preventDefault()}
        onDrop={(e) => {
          // dépôt dans le vide : à la fin de la racine
          if (e.target === e.currentTarget && dragId) {
            moveNode(dragId, null, roots.length);
            setDragId(null);
            setDrop(null);
          }
        }}
      >
        {roots.length === 0 && <p className="empty">Rien ici pour l'instant.</p>}
        {roots.map((n) => renderNode(n, 0))}
      </div>
      <div className="binder-foot">{sectionWords(roots).toLocaleString("fr-FR")} mots</div>
    </aside>
  );
}
