import type { TopicInfo } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { KAFKA_TOPICS, SURVEYS } from "@/lib/utils";

export default function KafkaAlertCounts({ topics, loading, error, splitByMatch }: {
  topics: TopicInfo[];
  loading: boolean;
  error: string | null;
  splitByMatch: boolean;
}) {
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (loading) return (
    <>{[1, 2].map((i) => <Card key={i} className="h-48 shimmer"/>)}</>
  );

  if (!topics.length) return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        No topics available.
      </CardContent>
    </Card>
  );

  const countByName = new Map(topics.map((t) => [t.name, t.n_alerts]));
  const retentionDays = topics[0]?.retention_days;
  const keyOf = (name: string) => {
    if (splitByMatch) return name;
    const [prefix, survey, , classification] = name.split(".");
    return `${prefix}.${survey}.*.${classification}`;
  };

  return (
    <>
      {SURVEYS.map((survey) => {
        const surveyTopics = KAFKA_TOPICS.filter((t) => t.split(".")[1] === survey);
        const groups = new Map<string, number>();
        for (const name of surveyTopics) {
          const k = keyOf(name);
          groups.set(k, (groups.get(k) ?? 0) + (countByName.get(name) ?? 0));
        }
        if (!groups.size) return null;
        const rows = [...groups];
        const total = rows.reduce((s, [, n]) => s + n, 0);

        return (
          <Card key={survey}>
            <CardHeader>
              <CardTitle>{survey.toUpperCase()}</CardTitle>
              <CardDescription>
                {surveyTopics.length} topics — {total.toLocaleString()} alerts
                {retentionDays !== undefined && ` — ${retentionDays}-day retention`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.map(([name, n]) => {
                const pct = total > 0 ? (n / total) * 100 : 0;
                return (
                  <div key={name} className="flex items-center gap-3">
                    <code className="text-xs text-muted-foreground w-72 shrink-0 truncate" title={name}>
                      {name}
                    </code>
                    <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${pct}%`, backgroundColor: `var(--color-${survey})` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-20 text-right">
                      {n.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
