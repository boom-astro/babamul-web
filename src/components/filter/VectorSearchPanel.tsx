/**
 * VectorSearchPanel — Find similar ZTF objects using Milvus vector search.
 * Integrated into the Filters page as a collapsible panel.
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Waypoints, Database, Clock, ExternalLink } from "lucide-react";
import { searchSimilarObjects, fetchMilvusHealth, type MilvusNeighbour, type MilvusHealthResponse } from "@/lib/api";

interface VectorSearchPanelProps {
  /** Optional: pre-fill the object ID from elsewhere in the UI */
  defaultObjectId?: string;
}

export function VectorSearchPanel({ defaultObjectId }: VectorSearchPanelProps) {
  const [searchParams] = useSearchParams();
  const urlObjectId = searchParams.get("vectorSearch");
  const [objectId, setObjectId] = useState(urlObjectId || defaultObjectId || "");
  const [topK, setTopK] = useState(10);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [minReconError, setMinReconError] = useState<string>("");

  const [neighbours, setNeighbours] = useState<MilvusNeighbour[]>([]);
  const [searchTimeMs, setSearchTimeMs] = useState<number | null>(null);
  const [totalEntities, setTotalEntities] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Health check
  const [health, setHealth] = useState<MilvusHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setHealthLoading(true);
    fetchMilvusHealth()
      .then((h) => { if (!cancelled) setHealth(h); })
      .catch(() => { if (!cancelled) setHealth(null); })
      .finally(() => { if (!cancelled) setHealthLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Auto-search when navigated here from Explorer with a pre-filled ID
  useEffect(() => {
    if (urlObjectId && health?.status === "ok") {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlObjectId, health?.status]);

  const handleSearch = useCallback(async () => {
    if (!objectId.trim()) return;
    setLoading(true);
    setError(null);
    setNeighbours([]);
    setSearchTimeMs(null);

    try {
      const result = await searchSimilarObjects({
        object_id: objectId.trim(),
        top_k: topK,
        min_recon_error: minReconError ? parseFloat(minReconError) : undefined,
        classification: classFilter !== "all" ? classFilter : undefined,
      });
      setNeighbours(result.neighbours);
      setSearchTimeMs(result.search_time_ms);
      setTotalEntities(result.total_entities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [objectId, topK, classFilter, minReconError]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  // Distance color coding
  const distanceColor = (d: number) => {
    if (d < 5) return "text-emerald-400";
    if (d < 15) return "text-amber-400";
    return "text-red-400";
  };

  // Classification badge color
  const classBadge = (cls: string) => {
    switch (cls) {
      case "SN": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "stellar": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "bogus": return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
      case "asteroid": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <Card id="vector-search-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waypoints className="h-4 w-4 text-violet-400" />
            Vector Search
          </div>
          {/* Health indicator */}
          {healthLoading ? (
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
          ) : health?.status === "ok" ? (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-normal text-muted-foreground">
                {health.entities.toLocaleString()} objects
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-[10px] font-normal text-red-400">offline</span>
            </div>
          )}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Find similar objects by RTF embedding similarity (L2 distance).
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Object ID input */}
        <div>
          <Label htmlFor="vectorSearchObjectId" className="text-xs font-medium mb-1 block text-muted-foreground">
            ZTF Object ID
          </Label>
          <div className="flex gap-2">
            <Input
              id="vectorSearchObjectId"
              value={objectId}
              onChange={(e) => setObjectId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. ZTF18aajleyh"
              className="flex-1 text-xs font-mono"
              disabled={loading}
            />
            <Button
              size="sm"
              className="h-9 text-xs"
              onClick={handleSearch}
              disabled={loading || !objectId.trim() || health?.status !== "ok"}
            >
              {loading ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Searching...</>
              ) : (
                <><Search className="h-3 w-3 mr-1" /> Find Similar</>
              )}
            </Button>
          </div>
        </div>

        {/* Filters row */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 block">Top-K</Label>
            <Input
              type="number"
              value={topK}
              onChange={(e) => setTopK(Math.min(100, Math.max(1, parseInt(e.target.value) || 10)))}
              className="text-xs h-8"
              min={1}
              max={100}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 block">Classification</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="SN">SN</SelectItem>
                <SelectItem value="bogus">Bogus</SelectItem>
                <SelectItem value="asteroid">Asteroid</SelectItem>
                <SelectItem value="stellar">Stellar</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1 block">Min Recon Error</Label>
            <Input
              type="number"
              step="any"
              value={minReconError}
              onChange={(e) => setMinReconError(e.target.value)}
              placeholder="any"
              className="text-xs h-8"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {/* Results table */}
        {!loading && neighbours.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-medium">Object ID</TableHead>
                    <TableHead className="text-[10px] font-medium">Class</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">Recon Error</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">Anomaly</TableHead>
                    <TableHead className="text-[10px] font-medium text-right">L2 Distance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {neighbours.map((n, i) => (
                    <TableRow key={i} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="text-xs font-mono py-1.5">
                        <a
                          href={`/objects/ZTF/${n.object_id}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                        >
                          {n.object_id}
                          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                        </a>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="outline" className={`text-[10px] ${classBadge(n.classification)}`}>
                          {n.classification}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-right py-1.5">
                        {n.recon_error.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-right py-1.5">
                        {n.anomaly_score.toFixed(3)}
                      </TableCell>
                      <TableCell className={`text-xs font-mono text-right py-1.5 font-semibold ${distanceColor(n.distance)}`}>
                        {n.distance.toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Search metadata */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {searchTimeMs !== null ? `${searchTimeMs.toFixed(0)}ms` : "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {totalEntities?.toLocaleString() ?? "—"} vectors searched
                </span>
              </div>
              <span>
                {neighbours.length} neighbour{neighbours.length !== 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !error && neighbours.length === 0 && (
          <div className="text-center text-muted-foreground py-4">
            <Waypoints className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              Enter a ZTF object ID to find its nearest neighbours by RTF embedding.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
