import { useRef, useState, FormEvent } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import api, { Alert, MocSearchParams } from "@/lib/api";
import { AlertSearchResults } from "@/components/alert-search-results";
import SkymapAladin, { RegionOverlay } from "@/components/SkymapAladin";

const PAGE_SIZE = 50;
const MAX_WINDOW_DAYS = 7;

type FileType = "skymap" | "moc";
type TriState = "any" | "true" | "false";

// JD <-> Unix conversions. JD 2440587.5 == Unix epoch.
function jdFromUnixMs(ms: number): number {
  return ms / 86_400_000 + 2440587.5;
}
// Format a Date as a `datetime-local` value (YYYY-MM-DDTHH:mm) using its UTC
// components, so it round-trips through jdFromDatetimeLocal (which reads UTC).
function toDatetimeLocalUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
// Parse a `datetime-local` value (interpreted as UTC) into a Julian Date.
function jdFromDatetimeLocal(value: string): number | undefined {
  if (!value) return undefined;
  // datetime-local is "YYYY-MM-DDTHH:mm" (no zone). Append Z to read it as UTC.
  const ms = Date.parse(`${value}:00Z`.replace(/(:\d\d):00Z$/, "$1Z"));
  return Number.isFinite(ms) ? jdFromUnixMs(ms) : undefined;
}

// Read a File into a base64 string (without the data: URL prefix).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function triToBool(v: TriState): boolean | undefined {
  return v === "any" ? undefined : v === "true";
}

export default function SkymapSearch() {
  const [fileType, setFileType] = useState<FileType>("skymap");
  const [file, setFile] = useState<File | null>(null);
  const [survey, setSurvey] = useState<"ZTF" | "LSST">("ZTF");
  const [credibleLevel, setCredibleLevel] = useState("0.9");
  // Default window: now - 6 days → now (within the 7-day server limit).
  const [startDate, setStartDate] = useState(() => toDatetimeLocalUTC(new Date(Date.now() - 6 * 86_400_000)));
  const [endDate, setEndDate] = useState(() => toDatetimeLocalUTC(new Date()));
  const [minMag, setMinMag] = useState("");
  const [maxMag, setMaxMag] = useState("");
  const [minDrb, setMinDrb] = useState("");
  const [maxDrb, setMaxDrb] = useState("");
  const [isRock, setIsRock] = useState<TriState>("any");
  const [isStar, setIsStar] = useState<TriState>("any");
  const [isNearBrightstar, setIsNearBrightstar] = useState<TriState>("any");
  const [isStationary, setIsStationary] = useState<TriState>("any");
  const [limit, setLimit] = useState("10000");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Results
  const [allAlerts, setAllAlerts] = useState<Alert[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [region, setRegion] = useState<RegionOverlay | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchResultsRef = useRef<HTMLDivElement | null>(null);

  const startJd = jdFromDatetimeLocal(startDate);
  const endJd = jdFromDatetimeLocal(endDate);
  const windowDays = startJd !== undefined && endJd !== undefined ? endJd - startJd : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select a FITS file to upload.");
      return;
    }
    if (startJd === undefined || endJd === undefined) {
      setError("Please provide both a start and end date.");
      return;
    }
    if (endJd <= startJd) {
      setError("End date must be after start date.");
      return;
    }
    if (endJd - startJd > MAX_WINDOW_DAYS) {
      setError(`Time window cannot exceed ${MAX_WINDOW_DAYS} days.`);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setAllAlerts([]);
    setMessage(null);
    setPage(1);
    requestAnimationFrame(() => {
      searchResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const base64 = await fileToBase64(file);
      const params: MocSearchParams = {
        start_jd: startJd,
        end_jd: endJd,
        limit: limit ? Math.max(1, Math.min(10000, parseInt(limit, 10) || 10000)) : undefined,
      };
      if (fileType === "skymap") {
        params.skymap_fits_base64 = base64;
        if (credibleLevel) params.credible_level = parseFloat(credibleLevel);
      } else {
        params.moc_fits_base64 = base64;
      }
      if (minMag) params.min_magpsf = parseFloat(minMag);
      if (maxMag) params.max_magpsf = parseFloat(maxMag);
      if (minDrb) params.min_drb = parseFloat(minDrb);
      if (maxDrb) params.max_drb = parseFloat(maxDrb);
      const rock = triToBool(isRock);
      const star = triToBool(isStar);
      const nbs = triToBool(isNearBrightstar);
      const stationary = triToBool(isStationary);
      if (rock !== undefined) params.is_rock = rock;
      if (star !== undefined) params.is_star = star;
      if (nbs !== undefined) params.is_near_brightstar = nbs;
      if (stationary !== undefined) params.is_stationary = stationary;

      const { alerts: results, moc } = await api.mocSearchAlerts(survey, params);
      setAllAlerts(results);
      setMessage(`Found ${results.length} alert${results.length !== 1 ? "s" : ""} in the region.`);

      // Overlay the queried region returned by the server (Aladin MOC JSON): for
      // a skymap it's already thresholded at the credible level, for a MOC file
      // it's the MOC itself. SkymapAladin draws it via A.MOCFromJSON.
      setRegion(moc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const pageAlerts = allAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-4 lg:px-6 space-y-4">
      <Card className="max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle>Skymap Alert Search</CardTitle>
          <CardDescription>
            Upload a HEALPix skymap or an IVOA MOC FITS file and find the alerts that fall inside
            the region within a Julian Date window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Survey */}
              <div className="rounded-lg border bg-muted/40 p-4 flex flex-col gap-3 sm:min-w-48">
                <span className="text-base font-semibold">Survey</span>
                <div className="flex h-9 items-center gap-1.5 text-sm">
                  {(["ZTF", "LSST"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSurvey(s)}
                      className={cn(
                        "flex h-full flex-1 items-center justify-center rounded-md border px-4 font-medium whitespace-nowrap transition-colors",
                        survey === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* File type */}
              <div className="rounded-lg border bg-muted/40 p-4 flex flex-col gap-3 flex-1">
                <span className="text-base font-semibold">Region file type</span>
                <div className="flex h-9 items-center gap-1.5 text-sm">
                  {(
                    [
                      ["skymap", "HEALPix skymap"],
                      ["moc", "MOC"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFileType(val)}
                      className={cn(
                        "flex h-full flex-1 items-center justify-center rounded-md border px-3 font-medium whitespace-nowrap transition-colors",
                        fileType === val
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* File upload */}
            <div>
              <Label htmlFor="skymap-file" className="text-xs font-medium mb-1 block text-muted-foreground">
                {fileType === "skymap" ? "Skymap FITS file" : "MOC FITS file"}
              </Label>
              <Input
                id="skymap-file"
                type="file"
                accept=".fits,.fit,.fits.gz,application/fits"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 py-[0.2rem] file:py-1 file:text-primary-foreground"
              />
              {file && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.name} — {(file.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>

            {/* Time window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start-date" className="text-xs font-medium mb-1 block text-muted-foreground">
                  Start (UTC){startJd !== undefined ? ` — JD ${startJd.toFixed(4)}` : ""}
                </Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-xs font-medium mb-1 block text-muted-foreground">
                  End (UTC){endJd !== undefined ? ` — JD ${endJd.toFixed(4)}` : ""}
                </Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {windowDays !== undefined && (
              <p
                className={cn(
                  "text-xs",
                  windowDays > MAX_WINDOW_DAYS || windowDays <= 0 ? "text-red-500" : "text-muted-foreground"
                )}
              >
                Window: {windowDays.toFixed(2)} days (max {MAX_WINDOW_DAYS}).
              </p>
            )}

            {/* Advanced filters toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={showAdvanced}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced ? "rotate-0" : "-rotate-90")} />
              Advanced filters
            </button>

            {showAdvanced && (
              <div className="space-y-5">
            {/* Numeric filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {fileType === "skymap" && (
                <div>
                  <Label htmlFor="credible" className="text-xs font-medium mb-1 block text-muted-foreground">
                    Credible level
                  </Label>
                  <Input
                    id="credible"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={credibleLevel}
                    onChange={(e) => setCredibleLevel(e.target.value)}
                    placeholder="0.9"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="min-mag" className="text-xs font-medium mb-1 block text-muted-foreground">Min magpsf</Label>
                <Input id="min-mag" type="number" step="any" value={minMag} onChange={(e) => setMinMag(e.target.value)} placeholder="—" />
              </div>
              <div>
                <Label htmlFor="max-mag" className="text-xs font-medium mb-1 block text-muted-foreground">Max magpsf</Label>
                <Input id="max-mag" type="number" step="any" value={maxMag} onChange={(e) => setMaxMag(e.target.value)} placeholder="—" />
              </div>
              <div>
                <Label htmlFor="min-drb" className="text-xs font-medium mb-1 block text-muted-foreground">
                  Min {survey === "LSST" ? "reliability" : "drb"}
                </Label>
                <Input id="min-drb" type="number" step="any" value={minDrb} onChange={(e) => setMinDrb(e.target.value)} placeholder="—" />
              </div>
              <div>
                <Label htmlFor="max-drb" className="text-xs font-medium mb-1 block text-muted-foreground">
                  Max {survey === "LSST" ? "reliability" : "drb"}
                </Label>
                <Input id="max-drb" type="number" step="any" value={maxDrb} onChange={(e) => setMaxDrb(e.target.value)} placeholder="—" />
              </div>
              <div>
                <Label htmlFor="limit" className="text-xs font-medium mb-1 block text-muted-foreground">Limit (max 10000)</Label>
                <Input id="limit" type="number" min="1" max="10000" value={limit} onChange={(e) => setLimit(e.target.value)} />
              </div>
            </div>

            {/* Classification flags */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ["Rock", isRock, setIsRock],
                  ["Star", isStar, setIsStar],
                  ["Near bright star", isNearBrightstar, setIsNearBrightstar],
                  ["Stationary", isStationary, setIsStationary],
                ] as const
              ).map(([label, value, setter]) => (
                <div key={label}>
                  <Label className="text-xs font-medium mb-1 block text-muted-foreground">{label}</Label>
                  <Select value={value} onValueChange={(v) => setter(v as TriState)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-red-500">{error}</div>
              <Button type="submit" disabled={loading}>
                {loading ? "Searching..." : "Search Alerts"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {hasSearched && (
        <div className="max-w-6xl mx-auto space-y-4">
          {message && !error && <p className="text-sm text-muted-foreground">{message}</p>}
          <SkymapAladin alerts={allAlerts} region={region} />
          <AlertSearchResults
            searchResultsRef={searchResultsRef}
            loading={loading}
            error={error}
            alerts={pageAlerts}
            survey={survey}
            currentPage={page}
            pageSize={PAGE_SIZE}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => (p * PAGE_SIZE < allAlerts.length ? p + 1 : p))}
          />
        </div>
      )}
    </div>
  );
}
