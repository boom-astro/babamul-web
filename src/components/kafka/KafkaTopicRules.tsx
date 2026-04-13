import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AND = () => <span className="text-muted-foreground">AND</span>;
const OR = () => <span className="text-muted-foreground">OR</span>;

function LsstRules() {
  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h3 className="mb-1 font-semibold text-destructive">excluded</h3>
          <ul className="text-sm list-disc pl-5">
            <li><code>dia_source.pixel_flags == true</code></li>
            <OR/>
            <li><code>ss_object_id exists</code> (solar-system object)</li>
          </ul>
        </div>

        <hr className="border-border" />

        <div>
          <h3 className="font-semibold text-chart-1">stellar</h3>
          <p className="text-xs text-muted-foreground mb-0.5">At least one LSPSC cross-match satisfies:</p>
          <ul className="text-sm list-disc pl-5">
            <li><code>match.distance &le; 1.0&Prime; <AND/> match.score &gt; 0.5</code></li>
            <OR/>
            <li><code>match.distance &le; 20.0&Prime; <AND/> match.score &gt; 0.5 <AND/> match.mag_white &le; 15.0</code>
            </li>
          </ul>
        </div>

        <hr className="border-border" />

        <div>
          <h3 className="mb-1 font-semibold text-chart-2">hosted</h3>
          <ul className="text-sm list-disc pl-5">
            <li><code>lspsc_matches exists</code></li>
            <div className="text-muted-foreground">AND</div>
            <li>at least one match with <code>match.score &le; 0.5</code></li>
          </ul>
        </div>

        <hr className="border-border" />

        <div>
          <h3 className="mb-1 font-semibold text-chart-4">hostless</h3>
          <ul className="text-sm list-disc pl-5">
            <li><code>lspsc_matches exists <AND/> all match.score &gt; 0.5</code></li>
            <OR/>
            <li><code>lspsc_matches is empty <AND/> (ra, dec) falls inside the LSPSC MOC (HEALPix depth&nbsp;11)</code></li>
          </ul>
        </div>

        <hr className="border-border" />

        <div>
          <h3 className="mb-1 font-semibold text-muted-foreground">unknown</h3>
          <ul className="text-sm list-disc pl-5">
            <li><code>lspsc_matches is empty</code></li>
            <div className="text-muted-foreground">AND</div>
            <li><code>(ra, dec)</code> falls outside the LSPSC MOC (HEALPix depth&nbsp;11)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ZtfRules() {
  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h3 className="mb-1 font-semibold text-destructive">excluded</h3>
          <ul className="text-sm list-disc pl-5">
            <li><code>candidate.programid != 1</code> (only public ZTF data)</li>
            <OR/>
            <li>
              <code>
                0 &le; candidate.ssdistnr &lt; 12.0&Prime; <AND/> candidate.ssmagnr &ge; 0
              </code> (solar-system object)
            </li>
            <OR/>
            <li><code>candidate.drb &lt; 0.2</code> (Deep Real/Bogus score)</li>
          </ul>
        </div>

        <hr className="border-border" />

        <div>
          <h3 className="mb-1 font-semibold text-chart-1">stellar</h3>
          <h4 className="pb-1 font-semibold pl-3 text-chart-1/75">star-like</h4>
          <ul className="text-sm list-disc pl-9">
            <li>
              <code>sgscore1 &gt; 0.76 <AND/> 0 &le; distpsnr1 &le; 2.0&Prime;</code>
            </li>
            <OR/>
            <li>
              <code>sgscore1 &gt; 0.2 <AND/> 0 &le; distpsnr1 &le; 1.0&Prime; <AND/> srmag1 &gt; 0 <AND/></code>
              <ul className="mt-1 ml-4 list-[circle] pl-5">
                <li>
                  <code>szmag1 &gt; 0 <AND/> srmag1 &minus; szmag1 &gt; 3</code>
                </li>
                <OR/>
                <li>
                  <code>simag1 &gt; 0 <AND/> srmag1 &minus; simag1 &gt; 3</code>
                </li>
              </ul>
            </li>
          </ul>
          <h4 className="pt-3 pb-1 font-semibold pl-3 text-chart-1/75">near bright star</h4>
          <ul className="text-sm list-disc pl-9">
            <li>
              <code>0 &le; neargaiabright &le; 20.0&Prime; <AND/> 0 &lt; maggaiabright &le; 12.0</code>
            </li>
            <OR/>
            <li>
              for some <code>N &isin; &#123;1, 2, 3&#125;: sgscoreN &gt; 0.49 <AND/> distpsnrN &le; 20.0&Prime;{" "}
              <AND/> 0 &lt; srmagN &le; 15.0</code>
            </li>
            <OR/>
            <li>
              <code>sgscore1 == 0.5 <AND/> distpsnr1 &lt; 0.5&Prime; <AND/>{" "}
              (sgmag1 &lt; 17 <OR/> srmag1 &lt; 17 <OR/> simag1 &lt; 17)</code>
            </li>
          </ul>
        </div>

        <hr className="border-border" />

        <div>
          <h3 className="mb-1 font-semibold text-chart-2">hosted</h3>
          <ul className="text-sm list-disc pl-5">
            <li>
              at least one of <code>sgscore1, sgscore2, sgscore3 satisfies 0.0 &le; score &le; 0.5</code>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground mt-1">
            Negative values (e.g. &minus;999) are ZTF pipeline placeholders and are ignored.
          </p>
        </div>

        <hr className="border-border" />

        <div>
          <h3 className="mb-1 font-semibold text-chart-4">hostless</h3>
          <ul className="text-sm list-disc pl-5">
            <li>fallback: not <code>stellar</code> and no valid <code>sgscoreN</code> in the hosted range</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-1">
            ZTF has no footprint MOC check, so there is no <em>unknown</em> category.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function KafkaTopicRules() {
  return (
    <Tabs defaultValue="lsst">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="lsst">LSST</TabsTrigger>
        <TabsTrigger value="ztf">ZTF</TabsTrigger>
      </TabsList>
      <TabsContent value="lsst">
        <LsstRules />
      </TabsContent>
      <TabsContent value="ztf">
        <ZtfRules />
      </TabsContent>
    </Tabs>
  );
}
