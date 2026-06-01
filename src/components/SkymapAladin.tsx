import { useEffect, useRef, useState } from "react";
import { loadAladinScript } from "@/lib/aladinLoader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Alert, AladinMocJson } from "@/lib/api";

// Aladin Lite v3 surface we use here. The shared global typing in
// `aladinLoader.ts` is intentionally minimal, so we widen it locally to reach
// the catalog / MOC helpers without sprinkling `any` everywhere.
type AladinSource = unknown;
type AladinCatalog = { addSources: (sources: AladinSource[]) => void };
type AladinMoc = unknown;
type AladinInstance = {
  addCatalog: (catalog: AladinCatalog) => void;
  addMOC?: (moc: AladinMoc) => void;
  removeLayers?: () => void;
  gotoRaDec?: (ra: number, dec: number) => void;
  setFov?: (fov: number) => void;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
};
type AladinApi = {
  aladin: (selector: string, options?: Record<string, unknown>) => AladinInstance;
  catalog: (options?: Record<string, unknown>) => AladinCatalog;
  source: (ra: number, dec: number, data?: Record<string, unknown>) => AladinSource;
  MOCFromJSON?: (json: Record<string, unknown>, options?: Record<string, unknown>) => AladinMoc;
};

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

// Extract a sky position from an alert, tolerating the small shape differences
// between ZTF and LSST payloads.
function alertCoords(alert: Alert): { ra: number; dec: number } | null {
  const candidate = (alert.candidate ?? {}) as Record<string, unknown>;
  const diaSource = (candidate["dia_source"] ?? candidate["diaSource"] ?? {}) as Record<string, unknown>;
  const ra = num(candidate["ra"]) ?? num(diaSource["ra"]) ?? num((alert as Record<string, unknown>)["ra"]);
  const dec = num(candidate["dec"]) ?? num(diaSource["dec"]) ?? num((alert as Record<string, unknown>)["dec"]);
  if (ra === undefined || dec === undefined) return null;
  return { ra, dec };
}

// The queried region, as Aladin MOC JSON computed server-side: for a
// probability skymap this is already thresholded at the credible level, and for
// a MOC file it's the MOC itself. Drawn directly with `A.MOCFromJSON`.
export type RegionOverlay = AladinMocJson;

export default function SkymapAladin({
  alerts,
  region,
}: {
  alerts: Alert[];
  region: RegionOverlay | null;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const aladinRef = useRef<AladinInstance | null>(null);

  useEffect(() => {
    loadAladinScript()
      .then(() => setIsLoaded(true))
      .catch((err) => console.error("Failed to load Aladin:", err));
  }, []);

  // Initialise the all-sky view once Aladin is available.
  useEffect(() => {
    if (!isLoaded || !window.A || aladinRef.current) return;
    const A = window.A as unknown as AladinApi;
    aladinRef.current = A.aladin("#skymap-aladin-div", {
      survey: "P/DSS2/color",
      projection: "AIT",
      fov: 180,
      cooFrame: "equatorial",
      showProjectionControl: true,
      showCooGridControl: true,
      showFullscreenControl: true,
    });
  }, [isLoaded]);

  // Rebuild the overlays (region + alert points) whenever the results change.
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!isLoaded || !aladin || !window.A) return;
    const A = window.A as unknown as AladinApi;

    // Clear any overlays from a previous search before drawing the new ones.
    aladin.removeLayers?.();

    // Overlay the queried region. The server returns it as Aladin MOC JSON
    // (a probability skymap already thresholded at the credible level, or the
    // uploaded MOC), which `A.MOCFromJSON` draws directly — no client-side
    // parsing of the raw FITS file.
    if (region && A.MOCFromJSON && aladin.addMOC) {
      try {
        const moc = A.MOCFromJSON(region, {
          color: "#3388ff",
          fillColor: "#3388ff",
          opacity: 0.25,
          lineWidth: 1,
          fill: true,
          perimeter: true,
          name: "Searched region",
        });
        aladin.addMOC(moc);
      } catch (err) {
        // Best-effort: if Aladin can't draw the MOC the matched alert points
        // still convey the region.
        console.warn("Could not overlay region:", err);
      }
    }

    const catalog = A.catalog({
      name: "Matched alerts",
      sourceSize: 10,
      color: "#ff4d4d",
      shape: "circle",
    });
    aladin.addCatalog(catalog);

    const sources: AladinSource[] = [];
    let first: { ra: number; dec: number } | null = null;
    for (const alert of alerts) {
      const coords = alertCoords(alert);
      if (!coords) continue;
      if (!first) first = coords;
      const candidate = (alert.candidate ?? {}) as Record<string, unknown>;
      sources.push(
        A.source(coords.ra, coords.dec, {
          objectId: alert.objectId ?? "",
          candid: String(alert.candid),
          ra: coords.ra.toFixed(5),
          dec: coords.dec.toFixed(5),
          jd: candidate["jd"] ?? alert.jd ?? "",
          magpsf: candidate["magpsf"] ?? "",
        })
      );
    }
    catalog.addSources(sources);

    // Centre on the first match so the user lands on the region of interest.
    // When there are no matches, leave the all-sky view so the region overlay
    // (which may be anywhere) stays visible.
    if (first && aladin.gotoRaDec) {
      aladin.gotoRaDec(first.ra, first.dec);
      aladin.setFov?.(20);
    } else {
      aladin.setFov?.(180);
    }
  }, [isLoaded, alerts, region]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sky map</CardTitle>
      </CardHeader>
      <CardContent>
        <div id="skymap-aladin-div" style={{ width: "100%", height: "500px" }} />
        <p className="mt-2 text-xs text-muted-foreground">
          Red points are alerts matched inside the uploaded region. The blue overlay shows the
          region itself (the credible-level contour for a skymap). Scroll to zoom, drag to pan.
        </p>
      </CardContent>
    </Card>
  );
}
