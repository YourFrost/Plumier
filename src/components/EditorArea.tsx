import { useStore, nodeById } from "../store";
import { Editor } from "./Editor";

function Tab({ id }: { id: string }) {
  const node = useStore((s) => nodeById(s, id));
  const { paneIds, split, activePane, select, closeTab } = useStore();
  if (!node) return null;
  const inPane = paneIds.indexOf(id);
  const shown = inPane === 0 || (split && inPane === 1);
  const current = paneIds[activePane] === id;
  return (
    <div className={`tab ${current ? "current" : ""} ${shown ? "shown" : ""}`} onClick={() => select(id)} title={node.title}>
      {split && shown && <i>{inPane === 0 ? "G" : "D"}</i>}
      <span>{node.title || "Sans titre"}</span>
      <button onClick={(e) => { e.stopPropagation(); closeTab(id); }} title="Fermer l'onglet">×</button>
    </div>
  );
}

export function EditorArea() {
  const { tabs, split, setSplit, activePane, setActivePane } = useStore();
  return (
    <div className="editor-area">
      <div className="tabbar">
        <div className="tabs-scroll">{tabs.map((t) => <Tab key={t} id={t} />)}</div>
        <button className={split ? "on" : ""} onClick={() => setSplit(!split)} title="Scinder l'écran en deux volets (Ctrl+\)">
          {split ? "▮ Un volet" : "◫ Scinder"}
        </button>
      </div>
      <div className="panes">
        <div className={`pane ${split && activePane === 0 ? "active" : ""}`} onMouseDownCapture={() => setActivePane(0)}>
          <Editor pane={0} />
        </div>
        {split && (
          <div className={`pane ${activePane === 1 ? "active" : ""}`} onMouseDownCapture={() => setActivePane(1)}>
            <Editor pane={1} />
          </div>
        )}
      </div>
    </div>
  );
}
