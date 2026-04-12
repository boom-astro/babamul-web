import { Card, CardContent } from "@/components/ui/card";

export default function KafkaTopicRules() {
  return (
    <>
      <Card>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-destructive">excluded</h3>
            <p className="text-xs text-muted-foreground mt-1">Alert is discarded when any of these is true:</p>
            <ul className="mt-1.5 space-y-0.5 text-xs list-disc pl-5">
              <li><code>pixel_flags == true</code></li>
              <li><code>ss_object_id</code> exists (solar-system object)</li>
            </ul>
          </div>

          <hr className="border-border" />

          <div>
            <h3 className="text-sm font-semibold text-chart-1">stellar</h3>
            <ul className="mt-1.5 space-y-0.5 text-xs list-disc pl-5">
              <li><code>properties.star == true</code></li>
              <li className="list-none -ml-5 text-muted-foreground">OR</li>
              <li><code>properties.near_brightstar == true</code></li>
            </ul>
          </div>

          <hr className="border-border" />

          <div>
            <h3 className="text-sm font-semibold text-chart-2">hosted</h3>
            <ul className="mt-1.5 space-y-0.5 text-xs list-disc pl-5">
              <li><code>lspsc_matches</code> exists</li>
              <li className="list-none -ml-5 text-muted-foreground">AND</li>
              <li>at least one match with <code>match.score &le; 0.5</code></li>
            </ul>
          </div>

          <hr className="border-border" />

          <div>
            <h3 className="text-sm font-semibold text-chart-3">hostless</h3>
            <ul className="mt-1.5 space-y-0.5 text-xs list-disc pl-5">
              <li><code>lspsc_matches</code> exists AND all <code>match.score &gt; 0.5</code></li>
              <li className="list-none -ml-5 text-muted-foreground">OR</li>
              <li><code>lspsc_matches</code> is empty AND <code>(ra, dec)</code> falls inside the LSPSC MOC (HEALPix depth&nbsp;11)</li>
            </ul>
          </div>

          <hr className="border-border" />

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">unknown</h3>
            <ul className="mt-1.5 space-y-0.5 text-xs list-disc pl-5">
              <li><code>lspsc_matches</code> is empty</li>
              <li className="list-none -ml-5 text-muted-foreground">AND</li>
              <li><code>(ra, dec)</code> falls outside the LSPSC MOC (HEALPix depth&nbsp;11)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
