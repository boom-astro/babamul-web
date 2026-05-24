/**
 * EmbeddingExplorer — Full-screen 3D embedding visualization.
 * Composes the Three.js canvas with the controls overlay.
 */

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { PointCloud, type ColormapName, CLASS_FAMILIES, classifyToFamily } from "./PointCloud";
import { ExplorerControls } from "./ExplorerControls";
import type { EmbeddingPoint } from "@/lib/api";
import { useState, useCallback, useMemo } from "react";

interface EmbeddingExplorerProps {
  points: EmbeddingPoint[];
  computeTimeMs: number | null;
  onRefresh: () => void;
  refreshing: boolean;
  onNavigateToSearch: (objectId: string) => void;
}

export function EmbeddingExplorer({
  points,
  computeTimeMs,
  onRefresh,
  refreshing,
  onNavigateToSearch,
}: EmbeddingExplorerProps) {
  const [colorBy, setColorBy] = useState<"classification" | "recon_error" | "anomaly_score">("classification");
  const [colormap, setColormap] = useState<ColormapName>("viridis");
  const [pointSize, setPointSize] = useState(0.06);
  const [showLabels, setShowLabels] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<EmbeddingPoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<EmbeddingPoint | null>(null);

  const handlePointClick = useCallback((point: EmbeddingPoint) => {
    setSelectedPoint((prev) => (prev?.id === point.id ? null : point));
  }, []);

  const handlePointHover = useCallback((point: EmbeddingPoint | null) => {
    setHoveredPoint(point);
  }, []);

  const handleSearchClick = useCallback(
    (objectId: string) => {
      onNavigateToSearch(objectId);
    },
    [onNavigateToSearch]
  );

  const labelCounts = useMemo(() => {
    if (!showLabels || colorBy !== "classification" || points.length === 0) return [];
    const counts: Record<string, number> = {};
    for (let i = 0; i < points.length; i++) {
      const family = classifyToFamily(points[i].classification);
      counts[family] = (counts[family] || 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, count]) => count >= 5)
      .map(([family, count]) => ({
        family,
        label: CLASS_FAMILIES[family]?.label ?? family,
        color: CLASS_FAMILIES[family]?.color ?? [0.5, 0.5, 0.5],
        count
      }))
      .sort((a, b) => b.count - a.count);
  }, [points, showLabels, colorBy]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: "calc(100vh - 120px)" }}>
      {/* Controls overlay */}
      <ExplorerControls
        colorBy={colorBy}
        onColorByChange={setColorBy}
        colormap={colormap}
        onColormapChange={setColormap}
        pointSize={pointSize}
        onPointSizeChange={setPointSize}
        showLabels={showLabels}
        onShowLabelsChange={setShowLabels}
        totalPoints={points.length}
        computeTimeMs={computeTimeMs}
        selectedPoint={selectedPoint}
        hoveredPoint={hoveredPoint}
        onSearchClick={handleSearchClick}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      {/* Keyboard hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[10px] text-zinc-600 bg-zinc-900/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-zinc-800">
        Drag to rotate · Scroll to zoom · Right-drag to pan · Click to select
      </div>

      {/* Static cluster labels overlay */}
      {showLabels && colorBy === "classification" && labelCounts.length > 0 && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end pointer-events-none">
          {labelCounts.map((cl) => (
            <div
              key={cl.family}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-lg border"
              style={{
                color: `rgb(${Math.round(cl.color[0] * 255)}, ${Math.round(cl.color[1] * 255)}, ${Math.round(cl.color[2] * 255)})`,
                backgroundColor: "rgba(10, 10, 15, 0.8)",
                borderColor: `rgba(${Math.round(cl.color[0] * 255)}, ${Math.round(cl.color[1] * 255)}, ${Math.round(cl.color[2] * 255)}, 0.4)`,
                backdropFilter: "blur(4px)",
              }}
            >
              {cl.label} ({cl.count})
            </div>
          ))}
        </div>
      )}

      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [0, 0, 14], fov: 60, near: 0.1, far: 500 }}
        style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #111118 100%)" }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        raycaster={{ params: { Points: { threshold: pointSize * 1.2 } } }}
      >
        {/* Ambient starfield background for depth */}
        <Stars
          radius={80}
          depth={60}
          count={2000}
          factor={3}
          saturation={0}
          fade
          speed={0.5}
        />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={0.4} />

        {/* Orbit controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={40}
          enablePan
          panSpeed={0.5}
          rotateSpeed={0.6}
        />

        {/* Point cloud */}
        <PointCloud
          points={points}
          colorBy={colorBy}
          colormap={colormap}
          pointSize={pointSize}
          highlightId={selectedPoint?.id ?? null}
          showLabels={showLabels}
          onPointClick={handlePointClick}
          onPointHover={handlePointHover}
        />
      </Canvas>
    </div>
  );
}
