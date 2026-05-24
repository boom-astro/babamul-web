/**
 * ExplorerControls — Floating overlay panel for the 3D Embedding Explorer.
 * Contains color-by dropdown, colormap selector, point size slider,
 * label toggle, stats display, and search integration.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Waypoints,
  RefreshCw,
  Clock,
  Database,
  Palette,
  CircleDot,
  Loader2,
  Minimize2,
  Maximize2,
  ScanSearch,
  Tag,
} from "lucide-react";
import type { EmbeddingPoint } from "@/lib/api";
import type { ColormapName } from "./PointCloud";
import { CLASS_FAMILIES } from "./PointCloud";
import { useState } from "react";

export interface ExplorerControlsProps {
  colorBy: "classification" | "recon_error" | "anomaly_score";
  onColorByChange: (value: "classification" | "recon_error" | "anomaly_score") => void;
  colormap: ColormapName;
  onColormapChange: (value: ColormapName) => void;
  pointSize: number;
  onPointSizeChange: (value: number) => void;
  showLabels: boolean;
  onShowLabelsChange: (value: boolean) => void;
  totalPoints: number;
  computeTimeMs: number | null;
  selectedPoint: EmbeddingPoint | null;
  hoveredPoint: EmbeddingPoint | null;
  onSearchClick: (objectId: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ExplorerControls({
  colorBy,
  onColorByChange,
  colormap,
  onColormapChange,
  pointSize,
  onPointSizeChange,
  showLabels,
  onShowLabelsChange,
  totalPoints,
  computeTimeMs,
  selectedPoint,
  hoveredPoint,
  onSearchClick,
  onRefresh,
  refreshing,
}: ExplorerControlsProps) {
  const [minimized, setMinimized] = useState(false);

  const displayPoint = selectedPoint || hoveredPoint;

  if (minimized) {
    return (
      <div className="absolute top-4 left-4 z-20">
        <Button
          size="sm"
          variant="outline"
          className="bg-zinc-900/90 backdrop-blur-sm border-zinc-700 text-zinc-300 hover:bg-zinc-800 shadow-lg"
          onClick={() => setMinimized(false)}
        >
          <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
          Controls
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-20 w-72">
      <Card className="bg-zinc-900/90 backdrop-blur-md border-zinc-700 shadow-2xl">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-semibold text-zinc-100">Embedding Explorer</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
              onClick={() => setMinimized(true)}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {totalPoints.toLocaleString()} objects
            </span>
            {computeTimeMs !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                UMAP: {(computeTimeMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          <Separator className="bg-zinc-700/50" />

          {/* Color by */}
          <div>
            <Label className="text-[10px] text-zinc-500 mb-1 block flex items-center gap-1">
              <Palette className="h-3 w-3" />
              Color By
            </Label>
            <Select value={colorBy} onValueChange={(v) => onColorByChange(v as typeof colorBy)}>
              <SelectTrigger className="h-8 text-xs bg-zinc-800/50 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classification">Classification</SelectItem>
                <SelectItem value="recon_error">Reconstruction Error</SelectItem>
                <SelectItem value="anomaly_score">Anomaly Score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Colormap (only for continuous) */}
          {colorBy !== "classification" && (
            <div>
              <Label className="text-[10px] text-zinc-500 mb-1 block">Colormap</Label>
              <Select value={colormap} onValueChange={(v) => onColormapChange(v as ColormapName)}>
                <SelectTrigger className="h-8 text-xs bg-zinc-800/50 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viridis">Viridis</SelectItem>
                  <SelectItem value="plasma">Plasma</SelectItem>
                  <SelectItem value="turbo">Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Classification legend */}
          {colorBy === "classification" && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(CLASS_FAMILIES).map(([key, { color, label }]) => (
                  <div key={key} className="flex items-center gap-1">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`,
                      }}
                    />
                    <span className="text-[10px] text-zinc-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Labels toggle */}
          {colorBy === "classification" && (
            <Button
              size="sm"
              variant={showLabels ? "secondary" : "ghost"}
              className="w-full text-xs h-7"
              onClick={() => onShowLabelsChange(!showLabels)}
            >
              <Tag className="h-3 w-3 mr-1.5" />
              {showLabels ? "Hide Cluster Labels" : "Show Cluster Labels"}
            </Button>
          )}

          {/* Point size */}
          <div>
            <Label className="text-[10px] text-zinc-500 mb-1 block flex items-center gap-1">
              <CircleDot className="h-3 w-3" />
              Point Size: {pointSize.toFixed(2)}
            </Label>
            <input
              type="range"
              min="0.01"
              max="0.15"
              step="0.005"
              value={pointSize}
              onChange={(e) => onPointSizeChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          <Separator className="bg-zinc-700/50" />

          {/* Selected / hovered point info */}
          {displayPoint ? (
            <div className="space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                {selectedPoint ? "Selected" : "Hovered"}
              </div>
              <div className="bg-zinc-800/70 rounded-md p-2 space-y-1">
                <div className="font-mono text-xs text-blue-400 font-semibold">
                  {displayPoint.id}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-zinc-700/50 border-zinc-600"
                  >
                    {displayPoint.classification || "unknown"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 text-[10px] text-zinc-400">
                  <span>Recon Error</span>
                  <span className="font-mono text-right">{displayPoint.recon_error.toFixed(4)}</span>
                  <span>Anomaly Score</span>
                  <span className="font-mono text-right">{displayPoint.anomaly_score.toFixed(4)}</span>
                </div>
              </div>
              {selectedPoint && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-8 bg-violet-600/20 border-violet-500/30 text-violet-300 hover:bg-violet-600/30"
                  onClick={() => onSearchClick(selectedPoint.id)}
                >
                  <ScanSearch className="h-3 w-3 mr-1.5" />
                  Find Neighbours
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center text-[10px] text-zinc-600 py-2">
              Click a point to select it
            </div>
          )}

          <Separator className="bg-zinc-700/50" />

          {/* Refresh */}
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs h-7 text-zinc-500 hover:text-zinc-300"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Recomputing UMAP...</>
            ) : (
              <><RefreshCw className="h-3 w-3 mr-1.5" /> Recompute UMAP</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
