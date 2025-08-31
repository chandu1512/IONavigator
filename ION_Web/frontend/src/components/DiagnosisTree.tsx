import React, { useRef, useEffect, useState, useMemo } from "react";
import Tree from "react-d3-tree";
import { renderContent } from "../API/requests";

type RawNode = {
  id?: string;
  name?: string;
  content?: any;
  step?: string;
  module?: string;
  parents?: RawNode[] | null;
};

type Props = { treeData: RawNode[] | RawNode };

const stepColors: Record<string, string> = {
  summary_fragments: "#FFB3BA",
  rag_diagnoses: "#BAE1FF",
  intra_module_merges: "#BAFFC9",
  inter_module_merges: "#FFFFBA",
  final_diagnosis: "#00FF00",
};

const labelFor = (node: RawNode) =>
  node.step === "final_diagnosis" ? "Final Diagnosis" : node.module || node.step || node.name || "Step";

const normalizeToArray = (data: RawNode[] | RawNode): RawNode[] => (Array.isArray(data) ? data : data ? [data] : []);

const toRD3 = (nodes: RawNode[]): any[] =>
  nodes.map((n) => ({
    name: n.name || "Step",
    attributes: { step: n.step || "", module: n.module || "", content: n.content },
    children: n.parents ? toRD3(normalizeToArray(n.parents)) : [],
  }));

const DiagnosisTree: React.FC<Props> = ({ treeData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    const fit = () => {
      if (!containerRef.current) return;
      setDims({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const dataArray = useMemo(() => normalizeToArray(treeData), [treeData]);
  const rd3Data = useMemo(() => {
    const arr = toRD3(dataArray);
    return arr.length ? arr[0] : null; // render one root
  }, [dataArray]);

  useEffect(() => {
    const count = (ns: any[]): number =>
      ns.reduce((acc, n) => acc + 1 + (n.children ? count(n.children) : 0), 0);
    const nodes = toRD3(dataArray);
    const n = count(nodes);
    setZoom(n > 60 ? 0.25 : n > 30 ? 0.4 : 0.6);
  }, [dataArray]);

  const renderNode = ({ nodeDatum, toggleNode, foreignObjectProps }: any) => {
    const color = stepColors[(nodeDatum.attributes?.step || "").toLowerCase()] || "#f0f0f0";
    return (
      <g>
        <circle r={10} onClick={toggleNode} />
        <foreignObject {...foreignObjectProps}>
          <div
            style={{
              border: "1px solid #bdbdbd",
              backgroundColor: color,
              padding: 6,
              overflow: "hidden",
              fontSize: 12,
              lineHeight: 1.2,
              borderRadius: 6,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              textAlign: "center",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
            title={`Step: ${nodeDatum.attributes?.step || ""}\nModule: ${nodeDatum.attributes?.module || ""}`}
            onClick={() => formatAndRenderJson(nodeDatum.attributes?.content, nodeDatum.name || "node")}
          >
            {labelFor({
              step: nodeDatum.attributes?.step,
              module: nodeDatum.attributes?.module,
              name: nodeDatum.name,
            })}
          </div>
        </foreignObject>
      </g>
    );
  };

  const formatAndRenderJson = async (content: any, name: string) => {
    try {
      const html = await renderContent(content, name);
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(html);
      win.document.close();
    } catch (e) {
      console.error("open content failed", e);
      alert("Unable to render this node.");
    }
  };

  return (
    <div ref={containerRef} style={{ width: "95vw", height: "calc(100vh - 220px)", margin: "0 auto" }}>
      {!rd3Data ? (
        <div style={{ textAlign: "center", color: "#666", paddingTop: 40 }}>No analysis steps available yet.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, margin: "8px 0 4px 8px", flexWrap: "wrap" }}>
            {Object.entries(stepColors).map(([k, v]) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, background: v, border: "1px solid #bbb" }} />
                <small style={{ color: "#444" }}>{k.replace(/_/g, " ")}</small>
              </span>
            ))}
          </div>
          <Tree
            data={rd3Data}
            orientation="vertical"
            pathFunc="step"
            renderCustomNodeElement={(props: any) =>
              renderNode({ ...props, foreignObjectProps: { width: 160, height: 50, x: -80, y: -25 } })
            }
            translate={{ x: dims.w / 2, y: 110 }}
            separation={{ siblings: 1.2, nonSiblings: 1.6 }}
            zoom={zoom}
            scaleExtent={{ min: 0.1, max: 2 }}
            nodeSize={{ x: 200, y: 200 }}
          />
        </>
      )}
    </div>
  );
};

export default DiagnosisTree;
