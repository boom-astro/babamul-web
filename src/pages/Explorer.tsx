/**
 * Explorer Page — 3D RTF Embedding Explorer.
 * Fetches UMAP-projected embeddings from the Milvus proxy
 * and renders them as an interactive 3D point cloud.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { EmbeddingExplorer } from "@/components/explorer/EmbeddingExplorer";
import { fetchEmbeddings3D, type EmbeddingPoint } from "@/lib/api";
import { Loader2, AlertTriangle, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Explorer() {
  const navigate = useNavigate();
  const [points, setPoints] = useState<EmbeddingPoint[]>([]);
  const [computeTimeMs, setComputeTimeMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmbeddings = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchEmbeddings3D(refresh);
      setPoints(data.points);
      setComputeTimeMs(data.compute_time_ms);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load embeddings. Is the Milvus proxy running on port 8100?"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEmbeddings();
  }, [loadEmbeddings]);

  const handleRefresh = useCallback(() => {
    loadEmbeddings(true);
  }, [loadEmbeddings]);

  const handleNavigateToSearch = useCallback(
    (objectId: string) => {
      // Navigate to filters page — the VectorSearchPanel will pick up the
      // objectId from the URL search params
      navigate(`/filters?vectorSearch=${encodeURIComponent(objectId)}`);
    },
    [navigate]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 120px)" }}>
        <div className="text-center space-y-4">
          <div className="relative">
            <Waypoints className="h-12 w-12 text-violet-400 mx-auto animate-pulse" />
            <Loader2 className="h-6 w-6 text-violet-500 animate-spin absolute -bottom-1 -right-1 mx-auto" style={{ left: "calc(50% + 8px)" }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-200">Loading Embedding Space</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Fetching 2,324 RTF embeddings and computing UMAP projection...
            </p>
            <p className="text-xs text-zinc-600 mt-2">
              First load may take ~10-15s while UMAP runs. Subsequent loads are cached.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "calc(100vh - 120px)" }}>
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-zinc-200">Connection Error</h2>
            <p className="text-sm text-zinc-400 mt-2">{error}</p>
          </div>
          <div className="space-y-2">
            <Button onClick={() => loadEmbeddings()} className="w-full">
              Retry
            </Button>
            <p className="text-[10px] text-zinc-600">
              Make sure the Milvus proxy is running:
              <code className="block mt-1 bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                uvicorn milvus_proxy:app --port 8100
              </code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmbeddingExplorer
      points={points}
      computeTimeMs={computeTimeMs}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      onNavigateToSearch={handleNavigateToSearch}
    />
  );
}
