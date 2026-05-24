/**
 * PointCloud — Three.js point cloud rendered via @react-three/fiber.
 * Uses SCREEN-SPACE projection picking for pixel-accurate hover/click.
 * Properly updates GPU color buffers when colorBy changes.
 */

import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { EmbeddingPoint } from "@/lib/api";

// ─── Classification grouping ───────────────────────────────────────────────
// Group the 65+ Fritz classifications into broad families for coloring.

const CLASS_FAMILIES: Record<string, { color: [number, number, number]; label: string }> = {
  "SN":       { color: [0.30, 0.60, 1.00], label: "SN" },            // blue
  "bogus":    { color: [0.50, 0.50, 0.55], label: "Bogus" },         // grey
  "asteroid": { color: [1.00, 0.75, 0.25], label: "Asteroid" },      // amber
  "stellar":  { color: [0.70, 0.40, 0.90], label: "Stellar" },       // purple
  "Ia":       { color: [0.30, 0.75, 1.00], label: "SN Ia" },         // light blue
  "Ib/c":     { color: [0.95, 0.50, 0.20], label: "SN Ib/c" },      // orange
  "II":       { color: [0.20, 0.85, 0.45], label: "SN II" },         // green
  "SLSN":     { color: [1.00, 0.85, 0.10], label: "SLSN" },         // yellow
  "TDE":      { color: [0.95, 0.25, 0.35], label: "TDE" },           // red
  "AGN":      { color: [0.85, 0.45, 0.90], label: "AGN/QSO" },      // magenta
  "CV":       { color: [0.20, 0.75, 0.85], label: "CV/Nova" },       // cyan
  "GRB":      { color: [1.00, 0.55, 0.65], label: "GRB" },           // pink
  "other":    { color: [0.35, 0.80, 0.65], label: "Other" },         // teal
};

function classifyToFamily(cls: string): string {
  if (!cls) return "other";
  const lc = cls.toLowerCase();

  // RTF model labels (exact matches first — these are what's in Milvus)
  if (lc === "sn") return "SN";
  if (lc === "bogus") return "bogus";
  if (lc === "asteroid") return "asteroid";
  if (lc === "stellar") return "stellar";
  if (lc === "unknown") return "other";

  // Fritz fine-grained labels (fallback for enriched data)
  if (lc.includes("ia")) return "Ia";
  if (lc.includes("ib") || (lc.includes("ic") && !lc.includes("slsn"))) return "Ib/c";
  if (lc.includes("slsn")) return "SLSN";
  if (lc.includes("ii") || lc.includes("iip") || lc.includes("iin") || lc.includes("iib")) return "II";
  if (lc.includes("tidal") || lc.includes("tde")) return "TDE";
  if (lc.includes("agn") || lc.includes("qso")) return "AGN";
  if (lc.includes("nova") || lc.includes("cataclysmic") || lc.includes("u gem") || lc.includes("am cvn")) return "CV";
  if (lc.includes("grb") || lc.includes("afterglow")) return "GRB";
  if (lc.includes("fbot")) return "Ib/c";

  return "other";
}

function getClassColor(cls: string): [number, number, number] {
  return CLASS_FAMILIES[classifyToFamily(cls)]?.color ?? CLASS_FAMILIES.other.color;
}

// ─── Colormaps ─────────────────────────────────────────────────────────────

function viridis(t: number): [number, number, number] {
  const r = 0.267 * Math.pow(t, 0.8) + 0.392 * Math.pow(t, 1.2) - 0.133 * Math.pow(t, 1.6) + 0.474 * Math.pow(t, 2.0);
  const g = 0.006 + 1.91 * Math.pow(t, 1.8) - 2.95 * Math.pow(t, 2.0) + 1.41 * Math.pow(t, 2.4);
  const b = 0.417 + 3.30 * Math.pow(t, 1.0) - 7.53 * Math.pow(t, 1.5) + 7.52 * Math.pow(t, 2.0) - 2.79 * Math.pow(t, 2.5);
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

function plasma(t: number): [number, number, number] {
  const r = 0.505 + 1.905 * t - 1.08 * t * t + 0.5 * t * t * t;
  const g = 0.016 - 0.392 * t + 1.56 * t * t - 1.68 * t * t * t + 1.08 * t * t * t * t;
  const b = 0.531 - 1.79 * t + 2.28 * t * t - 1.06 * t * t * t;
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

function turbo(t: number): [number, number, number] {
  const r = 0.13572 + 4.61539 * t - 42.6603 * t ** 2 + 132.132 * t ** 3 - 152.260 * t ** 4 + 56.718 * t ** 5;
  const g = 0.09140 + 2.26400 * t + 4.57932 * t ** 2 - 42.428 * t ** 3 + 51.001 * t ** 4 - 17.368 * t ** 5;
  const b = 0.10667 + 12.7640 * t - 60.582 * t ** 2 + 109.37 * t ** 3 - 89.260 * t ** 4 + 28.300 * t ** 5;
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

export const COLORMAPS = { viridis, plasma, turbo } as const;
export type ColormapName = keyof typeof COLORMAPS;
export { CLASS_FAMILIES, classifyToFamily };

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PointCloudProps {
  points: EmbeddingPoint[];
  colorBy: "classification" | "recon_error" | "anomaly_score";
  colormap: ColormapName;
  pointSize: number;
  highlightId: string | null;
  showLabels: boolean;
  onPointClick: (point: EmbeddingPoint) => void;
  onPointHover: (point: EmbeddingPoint | null) => void;
}

// ─── Screen-space picking ───────────────────────────────────────────────────

function pickPointScreenSpace(
  mouseNDC: THREE.Vector2,
  positions: Float32Array,
  camera: THREE.Camera,
  maxNDCDistSq: number,
): number | null {
  const vec = new THREE.Vector3();
  let bestIdx: number | null = null;
  let bestDist = maxNDCDistSq;

  const count = positions.length / 3;
  for (let i = 0; i < count; i++) {
    vec.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    vec.project(camera);
    if (vec.z < -1 || vec.z > 1) continue;

    const dx = vec.x - mouseNDC.x;
    const dy = vec.y - mouseNDC.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PointCloud({
  points,
  colorBy,
  colormap,
  pointSize,
  highlightId,
  showLabels,
  onPointClick,
  onPointHover,
}: PointCloudProps) {
  const meshRef = useRef<THREE.Points>(null);
  const colorAttrRef = useRef<THREE.BufferAttribute>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { camera, gl, size } = useThree();

  // Compute positions (centered and scaled)
  const positions = useMemo(() => {
    if (points.length === 0) return new Float32Array(0);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const maxRange = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const sf = 8 / maxRange;

    const arr = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      arr[i * 3] = (points[i].x - cx) * sf;
      arr[i * 3 + 1] = (points[i].y - cy) * sf;
      arr[i * 3 + 2] = (points[i].z - cz) * sf;
    }
    return arr;
  }, [points]);

  // Compute colors
  const colors = useMemo(() => {
    if (points.length === 0) return new Float32Array(0);

    const arr = new Float32Array(points.length * 3);
    const colormapFn = COLORMAPS[colormap];

    if (colorBy === "classification") {
      for (let i = 0; i < points.length; i++) {
        const color = getClassColor(points[i].classification);
        arr[i * 3] = color[0];
        arr[i * 3 + 1] = color[1];
        arr[i * 3 + 2] = color[2];
      }
    } else {
      const field = colorBy as "recon_error" | "anomaly_score";
      let min = Infinity, max = -Infinity;
      for (const p of points) {
        const v = p[field];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const range = max - min || 1;
      for (let i = 0; i < points.length; i++) {
        const t = (points[i][field] - min) / range;
        const [r, g, b] = colormapFn(t);
        arr[i * 3] = r;
        arr[i * 3 + 1] = g;
        arr[i * 3 + 2] = b;
      }
    }

    // Highlight selected point (bright white)
    if (highlightId) {
      for (let i = 0; i < points.length; i++) {
        if (points[i].id === highlightId) {
          arr[i * 3] = 1;
          arr[i * 3 + 1] = 1;
          arr[i * 3 + 2] = 1;
          break;
        }
      }
    }
    return arr;
  }, [points, colorBy, colormap, highlightId]);

  // ** FIX: Force GPU buffer update when colors change **
  useEffect(() => {
    if (colorAttrRef.current) {
      colorAttrRef.current.array = colors;
      colorAttrRef.current.needsUpdate = true;
    }
  }, [colors]);

  // Compute cluster labels — placed at each class's most isolated point, not centroid
  const clusterLabels = useMemo(() => {
    if (!showLabels || colorBy !== "classification" || points.length === 0) return [];

    // Overall cloud center
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < points.length; i++) {
      cx += positions[i * 3];
      cy += positions[i * 3 + 1];
      cz += positions[i * 3 + 2];
    }
    cx /= points.length;
    cy /= points.length;
    cz /= points.length;

    // For each class, find the point farthest from center (best "edge" representative)
    const bestPerClass: Record<string, { dist: number; idx: number; count: number }> = {};

    for (let i = 0; i < points.length; i++) {
      const family = classifyToFamily(points[i].classification);
      const dx = positions[i * 3] - cx;
      const dy = positions[i * 3 + 1] - cy;
      const dz = positions[i * 3 + 2] - cz;
      const dist = dx * dx + dy * dy + dz * dz;

      if (!bestPerClass[family]) {
        bestPerClass[family] = { dist, idx: i, count: 1 };
      } else {
        bestPerClass[family].count++;
        if (dist > bestPerClass[family].dist) {
          bestPerClass[family].dist = dist;
          bestPerClass[family].idx = i;
        }
      }
    }

    const labels = Object.entries(bestPerClass)
      .filter(([, c]) => c.count >= 5)
      .map(([family, c]) => ({
        family,
        label: CLASS_FAMILIES[family]?.label ?? family,
        color: CLASS_FAMILIES[family]?.color ?? [0.5, 0.5, 0.5] as [number, number, number],
        count: c.count,
        position: new THREE.Vector3(
          positions[c.idx * 3],
          positions[c.idx * 3 + 1] + 0.4,
          positions[c.idx * 3 + 2]
        ),
      }));

    return labels;
  }, [points, positions, showLabels, colorBy]);

  // Pick threshold: ~15 pixels in NDC (squared)
  const pickThresholdSq = useMemo(() => {
    const px = 15 / Math.min(size.width, size.height) * 2;
    return px * px;
  }, [size]);

  const toNDC = useCallback(
    (clientX: number, clientY: number): THREE.Vector2 => {
      const rect = gl.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
    },
    [gl]
  );

  // DOM event listeners for screen-space picking
  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerMove = (e: PointerEvent) => {
      if (points.length === 0 || !positions.length) return;
      const ndc = toNDC(e.clientX, e.clientY);
      const idx = pickPointScreenSpace(ndc, positions, camera, pickThresholdSq);
      if (idx !== null) {
        setHoveredIdx(idx);
        onPointHover(points[idx]);
      } else {
        setHoveredIdx(null);
        onPointHover(null);
      }
    };

    const onClick = (e: MouseEvent) => {
      if (points.length === 0 || !positions.length) return;
      const ndc = toNDC(e.clientX, e.clientY);
      const idx = pickPointScreenSpace(ndc, positions, camera, pickThresholdSq);
      if (idx !== null) {
        onPointClick(points[idx]);
      }
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [gl, points, positions, camera, toNDC, pickThresholdSq, onPointHover, onPointClick]);

  // Hovered point world position for tooltip
  const hoveredPos = useMemo(() => {
    if (hoveredIdx === null || !positions.length) return null;
    return new THREE.Vector3(
      positions[hoveredIdx * 3],
      positions[hoveredIdx * 3 + 1],
      positions[hoveredIdx * 3 + 2]
    );
  }, [hoveredIdx, positions]);

  if (points.length === 0) return null;

  return (
    <group>
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={positions}
            count={points.length}
            itemSize={3}
          />
          <bufferAttribute
            ref={colorAttrRef}
            attach="attributes-color"
            array={colors}
            count={points.length}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={pointSize}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </points>

      {/* Tooltip on hover */}
      {hoveredIdx !== null && hoveredPos && (
        <Html position={hoveredPos} center style={{ pointerEvents: "none" }}>
          <div
            className="bg-zinc-900/95 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white shadow-xl backdrop-blur-sm whitespace-nowrap"
            style={{ transform: "translateY(-120%)" }}
          >
            <div className="font-mono font-semibold text-blue-400">
              {points[hoveredIdx].id}
            </div>
            <div className="text-zinc-400 mt-0.5">
              {points[hoveredIdx].classification || "unknown"} · recon: {points[hoveredIdx].recon_error.toFixed(2)} · anomaly: {points[hoveredIdx].anomaly_score.toFixed(3)}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
