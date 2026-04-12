import { useState, useEffect, Suspense } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { fetchTopics, fetchSchema, type TopicInfo, type AvroSchema } from "@/lib/api";
import { SURVEYS } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import KafkaAlertCounts from "@/components/kafka/KafkaAlertCounts";
import KafkaTopicRules from "@/components/kafka/KafkaTopicRules";
import KafkaSchemas from "@/components/kafka/KafkaSchemas";
import KafkaMarkdownDocs from "@/components/KafkaMarkdownDocs.tsx";

export default function KafkaDocs() {
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<Record<string, AvroSchema>>({});
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchTopics()
      .then(setTopics)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to fetch topics"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all(
      SURVEYS.map((s) =>
        fetchSchema(s)
          .then((schema) => [s, schema] as const)
          .catch(() => [s, null] as const)
      )
    ).then((results) => {
      const map: Record<string, AvroSchema> = {};
      for (const [survey, schema] of results) {
        if (schema) map[survey] = schema;
      }
      setSchemas(map);
    });
  }, []);

  function TopicsDocsModal() {
    return (
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl! max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Object appearance in output topics</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<div className="text-center py-10">Loading documentation...</div>}>
            <KafkaMarkdownDocs/>
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="px-4 lg:px-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kafka Documentation</h1>
        <Button variant="outline" size="sm" asChild>
          <Link to="/docs/kafka/access-guide">
            Access guide <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <h2 className="text-xl font-bold pt-4">Schemas</h2>
      <KafkaSchemas schemas={schemas} />

      <h2 className="text-xl font-bold pt-4">Alert Counts</h2>
      <KafkaAlertCounts topics={topics} loading={loading} error={error} />

      <h2 id="topics" className="text-xl font-bold pt-4">Topics</h2>
      <p className="text-sm text-muted-foreground">
        Each alert is routed to a topic based on the following filtering rules. Alerts that match the <span className="text-destructive">excluded</span> criteria are dropped.{" "}
        <button onClick={() => setShowModal(true)} className="text-primary hover:underline cursor-pointer">
          Learn more about how objects will appear in topics
        </button>
      </p>
      <TopicsDocsModal/>
      <KafkaTopicRules/>
    </div>
  );
}
