import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AvroSchema } from "@/lib/api";
import { SchemaFields } from "@/components/SchemaViewer";

const LSST_SCHEMA_URL =
  "https://usdf-alert-schemas-dev.slac.stanford.edu/subjects/alert-packet/versions/1000";

export default function SurveySchemas() {
  const [lsstSchema, setLsstSchema] = useState<AvroSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(LSST_SCHEMA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch LSST schema: ${res.status}`);
        return res.json();
      })
      .then((body) => {
        const schema = typeof body.schema === "string" ? JSON.parse(body.schema) : body.schema;
        setLsstSchema(schema);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to fetch schema"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 lg:px-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Survey Alert Schemas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Original Avro schemas published by each survey, before any processing by Boom.
        </p>
      </div>

      <Tabs defaultValue="lsst">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lsst">LSST</TabsTrigger>
          <TabsTrigger value="ztf">ZTF</TabsTrigger>
        </TabsList>

        <TabsContent value="lsst">
          {loading ? (
            <Card><CardContent className="py-8"><div className="h-32 animate-pulse rounded bg-muted" /></CardContent></Card>
          ) : error ? (
            <Card><CardContent className="py-8 text-center text-destructive">{error}</CardContent></Card>
          ) : lsstSchema ? (
            <Card>
              <CardHeader className="flex justify-between">
                <div>
                  <CardTitle>LSST</CardTitle>
                  <CardDescription>
                    {lsstSchema.namespace} — alert-packet v1000
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <SchemaFields schema={lsstSchema}/>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="ztf">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              ZTF schema — coming soon.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
