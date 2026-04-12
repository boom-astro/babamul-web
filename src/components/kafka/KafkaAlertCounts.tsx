import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { TopicInfo } from "@/lib/api";
import { KAFKA_TOPICS } from "@/lib/utils";

function surveyFromTopic(name: string): string {
  if (name.startsWith("babamul.ztf")) return "ztf";
  if (name.startsWith("babamul.lsst")) return "lsst";
  return "other";
}

export default function KafkaAlertCounts({ topics, loading, error }: {
  topics: TopicInfo[];
  loading: boolean;
  error: string | null;
}) {
  const alertsByName = new Map(topics.map((t) => [t.name, t.n_alerts]));
  const allTopics: TopicInfo[] = KAFKA_TOPICS.map((name) => ({
    name,
    n_alerts: alertsByName.get(name) ?? 0,
  }));

  const grouped = new Map<string, TopicInfo[]>();
  for (const t of allTopics) {
    const survey = surveyFromTopic(t.name);
    const arr = grouped.get(survey) ?? [];
    arr.push(t);
    grouped.set(survey, arr);
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (loading) return (
    <>
      {[1, 2].map((i) => <Card key={i} className="h-48 shimmer" />)}
    </>
  );

  if (!topics.length) return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        No topics available.
      </CardContent>
    </Card>
  );

  return (
    <>
      {Array.from(grouped.entries()).map(([survey, surveyTopics]) => (
        <Card key={survey}>
          <CardHeader>
            <CardTitle>{survey.toUpperCase()}</CardTitle>
            <CardDescription>
              {surveyTopics.length} topics — {surveyTopics.reduce((s, t) => s + t.n_alerts, 0).toLocaleString()} alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {surveyTopics.map((t) => {
              const surveyTotal = surveyTopics.reduce((s, st) => s + st.n_alerts, 0);
              const pct = surveyTotal > 0 ? (t.n_alerts / surveyTotal) * 100 : 0;
              return (
                <div key={t.name} className="flex items-center gap-3">
                  <code className="text-xs text-muted-foreground w-72 shrink-0 truncate" title={t.name}>
                    {t.name}
                  </code>
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded transition-all`}
                      style={{ width: `${pct}%`, backgroundColor: `var(--color-${survey})` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums w-20 text-right">
                    {t.n_alerts.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
