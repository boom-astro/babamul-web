import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Toggle } from "@/components/ui/toggle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api, { CatalogEntry, DailyStat } from "@/lib/api";

const SURVEY_COLORS = {
  ztf: {light: "#3b82f6", dark: "#3b82f6"},
  lsst: {light: "#34d399", dark: "#34d399"},
} as const;

const chartConfig = {
  ztf: {
    label: "ZTF",
    theme: SURVEY_COLORS.ztf,
  },
  lsst: {
    label: "LSST",
    theme: SURVEY_COLORS.lsst,
  },
} satisfies ChartConfig;

type Survey = "ztf" | "lsst";

type MergedStat = {
  date: string;
  ztf?: number;
  lsst?: number;
};

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

export default function NightlyStats() {
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setMonth(defaultStart.getMonth() - 2);

  const [surveys, setSurveys] = useState<Set<Survey>>(new Set(["ztf", "lsst"]));
  const [startDate, setStartDate] = useState(formatDate(defaultStart));
  const [endDate, setEndDate] = useState(formatDate(defaultEnd));
  const [ztfData, setZtfData] = useState<DailyStat[]>([]);
  const [lsstData, setLsstData] = useState<DailyStat[]>([]);
  const [catalogs, setCatalogs] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zoom: drag-select on chart to zoom, double-click to reset
  const [zoomLeft, setZoomLeft] = useState<string | null>(null);
  const [zoomRight, setZoomRight] = useState<string | null>(null);
  const selectingRef = useRef(false);
  const [zoomSlice, setZoomSlice] = useState<[number, number] | null>(null);

  function toggleSurvey(s: Survey) {
    setSurveys(prev => new Set(prev.has(s) ? [...prev].filter(x => x !== s) : [...prev, s]));
  }

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ztf, lsst] = await Promise.all([
        api.fetchStats("ztf", startDate, endDate).catch(() => [] as DailyStat[]),
        api.fetchStats("lsst", startDate, endDate).catch(() => [] as DailyStat[]),
      ]);
      setZtfData(ztf);
      setLsstData(lsst);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    api.fetchCatalogStats()
      .then((s) => setCatalogs(s.catalogs.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {
      });
  }, []);

  const mergedData = useMemo(() => {
    const map = new Map<string, MergedStat>();
    for (const d of ztfData) {
      map.set(d.date, {date: d.date, ztf: d.n_alerts});
    }
    for (const d of lsstData) {
      const existing = map.get(d.date);
      if (existing) {
        existing.lsst = d.n_alerts;
      } else {
        map.set(d.date, {date: d.date, lsst: d.n_alerts});
      }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [ztfData, lsstData]);

  const visibleData = useMemo(() => {
    if (surveys.has("ztf") && surveys.has("lsst")) return mergedData;
    return mergedData.map((d) => ({
      date: d.date,
      ...(surveys.has("ztf") ? {ztf: d.ztf} : {}),
      ...(surveys.has("lsst") ? {lsst: d.lsst} : {}),
    }));
  }, [mergedData, surveys]);

  const chartData = useMemo(() => {
    if (!zoomSlice) return visibleData;
    return visibleData.slice(zoomSlice[0], zoomSlice[1] + 1);
  }, [visibleData, zoomSlice]);

  function handleMouseDown(e: { activeLabel?: string }) {
    if (e?.activeLabel) {
      selectingRef.current = true;
      setZoomLeft(e.activeLabel);
      setZoomRight(null);
    }
  }

  function handleMouseMove(e: { activeLabel?: string }) {
    if (selectingRef.current && e?.activeLabel) {
      setZoomRight(e.activeLabel);
    }
  }

  function handleMouseUp() {
    if (selectingRef.current && zoomLeft && zoomRight && zoomLeft !== zoomRight) {
      const dates = visibleData.map(d => d.date);
      let li = dates.indexOf(zoomLeft);
      let ri = dates.indexOf(zoomRight);
      if (li > ri) [li, ri] = [ri, li];
      if (li >= 0 && ri >= 0 && ri - li >= 1) {
        setZoomSlice([li, ri]);
      }
    }
    selectingRef.current = false;
    setZoomLeft(null);
    setZoomRight(null);
  }

  function handleZoomReset() {
    setZoomSlice(null);
  }

  const totalAlerts = useMemo(() =>
      visibleData.reduce((s, d) => s + (d.ztf ?? 0) + (d.lsst ?? 0), 0),
    [visibleData]);
  const nbNightsWithAlerts = useMemo(() =>
      visibleData.filter(d => (d.ztf ?? 0) + (d.lsst ?? 0) > 0).length,
    [visibleData]);
  const avgAlerts = useMemo(() =>
      nbNightsWithAlerts ? Math.round(totalAlerts / nbNightsWithAlerts) : 0,
    [totalAlerts, nbNightsWithAlerts]);
  const maxNight = useMemo(() =>
      visibleData.reduce<{ date: string; total: number } | null>((max, d) => {
        const total = (d.ztf ?? 0) + (d.lsst ?? 0);
        return !max || total > max.total ? {date: d.date, total} : max;
      }, null),
    [visibleData]);

  return (
    <div className="px-4 lg:px-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statistics</h1>
      </div>
      {visibleData.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Alerts</CardDescription>
              <CardTitle className="text-2xl">{totalAlerts.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg / Night</CardDescription>
              <CardTitle className="text-2xl">{avgAlerts.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Peak Night</CardDescription>
              <CardTitle className="text-2xl">
                {maxNight?.total ? `${maxNight.total.toLocaleString()} (${maxNight.date})` : "-"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No data...
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Alerts per Night
              </CardTitle>
              <CardDescription>
                ({chartData.length} nights{zoomSlice ? " — zoomed" : ""})
              </CardDescription>
            </div>
            {zoomSlice && (
              <Toggle onPressedChange={handleZoomReset} className="text-xs text-muted-foreground hover:text-foreground underline">
                Reset zoom
              </Toggle>
            )}
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <Toggle variant="outline" size="sm" pressed={surveys.has("ztf")}
                        onPressedChange={() => toggleSurvey("ztf")}>
                  ZTF
                </Toggle>
                <Toggle variant="outline" size="sm" pressed={surveys.has("lsst")}
                        onPressedChange={() => toggleSurvey("lsst")}>
                  LSST
                </Toggle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-37 h-8 text-xs"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-37 h-8 text-xs"
                />
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardHeader>
        <CardContent>
          {!loading ? (
            <ChartContainer config={chartConfig} className="h-87.5 w-full">
              <BarChart
                data={chartData}
                margin={{top: 4, right: 4, bottom: 0, left: 4}}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDoubleClick={handleZoomReset}
              >
                <CartesianGrid vertical={false}/>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T00:00:00");
                    return d.toLocaleDateString("en-US", {month: "short", day: "numeric"});
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        if (!payload?.[0]?.payload?.date) return "";
                        const d = new Date(payload[0].payload.date + "T00:00:00");
                        return d.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        });
                      }}
                    />
                  }
                />
                {surveys.has("ztf") && (
                  <Bar dataKey="ztf" fill="var(--color-ztf)" radius={[2, 2, 0, 0]}/>
                )}
                {surveys.has("lsst") && (
                  <Bar dataKey="lsst" fill="var(--color-lsst)" radius={[2, 2, 0, 0]}/>
                )}
                {zoomLeft && zoomRight && (
                  <ReferenceArea x1={zoomLeft} x2={zoomRight} strokeOpacity={0.3} fill="hsl(var(--accent))" fillOpacity={0.3} />
                )}
              </BarChart>
            </ChartContainer>
            ) : (
              <div className="flex h-87.5 w-full animate-pulse items-center justify-center rounded bg-muted">
                <div className="h-87.5 animate-pulse rounded bg-muted"/>
              </div>
            )}
        </CardContent>
      </Card>

      {catalogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Catalogs</CardTitle>
            <CardDescription>{catalogs.length} catalogs available</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalogs.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-mono text-sm">{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBytes(c.size_bytes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.count.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
