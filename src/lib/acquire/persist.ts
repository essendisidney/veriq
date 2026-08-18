import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AcquisitionAssessment } from "@/lib/acquire/types";
import {
  KENYA_SOURCE_REGISTRY,
  registryLight,
  type RegistryLight,
} from "@/lib/acquire/connectors";
import type { ConnectorRunResult } from "@/lib/acquire/connectors";

export async function persistAcquisition(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  acquisition: AcquisitionAssessment,
  runs: ConnectorRunResult[],
) {
  const byConnector = new Map(runs.map((row) => [row.connectorId, row]));

  for (const entity of acquisition.entities) {
    await supabase.from("veriq_entities").upsert(
      {
        organization_id: organizationId,
        entity_key: entity.id,
        kind: entity.kind,
        label: entity.label,
        keys: entity.keys,
        related_keys: entity.related,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,entity_key" },
    );
  }

  const { data: storedEntities } = await supabase
    .from("veriq_entities")
    .select("id, entity_key")
    .eq("organization_id", organizationId);
  const entityIds = new Map(
    (storedEntities ?? []).map((row) => [row.entity_key as string, row.id as string]),
  );

  for (const fact of acquisition.observations) {
    const entityId = entityIds.get(fact.entityId);
    if (!entityId) continue;
    await supabase.from("veriq_facts").upsert(
      {
        organization_id: organizationId,
        entity_id: entityId,
        claim: fact.claim,
        value: fact.value,
        connector_id: fact.connectorId,
        source_type: fact.sourceType,
        source_ref: fact.sourceRef ?? null,
        confidence: fact.confidence,
        access_method: fact.access,
        excerpt: fact.excerpt ?? null,
        content_hash: fact.hash,
        amount_minor: fact.amountMinor ?? null,
        currency: fact.currency ?? null,
        unit: fact.unit ?? null,
        period_start: fact.periodStart ?? null,
        period_end: fact.periodEnd ?? null,
        observed_at: fact.retrievedAt,
      },
      { onConflict: "organization_id,entity_id,claim,content_hash" },
    );
  }

  const { data: storedFacts } = await supabase
    .from("veriq_facts")
    .select("id, claim, value, content_hash")
    .eq("organization_id", organizationId);

  for (const conflict of acquisition.conflicts) {
    const left = (storedFacts ?? []).find(
      (row) => row.claim === conflict.left.claim && row.value === conflict.left.value,
    );
    const right = (storedFacts ?? []).find(
      (row) => row.claim === conflict.right.claim && row.value === conflict.right.value,
    );
    if (!left || !right || left.id === right.id) continue;
    await supabase.from("veriq_fact_conflicts").upsert(
      {
        organization_id: organizationId,
        left_fact_id: left.id,
        right_fact_id: right.id,
        claim: conflict.claim,
        why: conflict.why,
        variance_pct: conflict.variancePct ?? null,
        left_value: conflict.left.value,
        right_value: conflict.right.value,
        validation_status: "requires_validation",
      },
      { onConflict: "left_fact_id,right_fact_id" },
    );
  }

  for (const source of KENYA_SOURCE_REGISTRY) {
    const connected = source.connectorIds
      .map((id) => byConnector.get(id))
      .filter(Boolean) as ConnectorRunResult[];
    const observed = connected.some((row) => row.observed);
    const status = connected.find((row) => row.status === "connected")?.status ??
      connected[0]?.status ??
      "available";
    const light: RegistryLight = registryLight({
      starter: source.starter,
      connectorStatus: status,
      observed,
    });
    const note =
      connected.find((row) => row.observed)?.note ??
      connected[0]?.note ??
      "Connector slot exists. No authorised feed is live.";
    await supabase.from("veriq_source_runs").upsert(
      {
        organization_id: organizationId,
        source_id: source.id,
        registry_status: light,
        observed,
        note,
        evidence_count: connected.reduce((sum, row) => sum + row.observations.length, 0),
        ran_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,source_id" },
    );
  }

  for (const edge of acquisition.edges ?? []) {
    await supabase.from("veriq_edges").upsert(
      {
        organization_id: organizationId,
        from_key: edge.fromKey,
        to_key: edge.toKey,
        kind: edge.kind,
        confidence: edge.confidence,
        validation_status: edge.validationStatus,
        why: edge.why,
        source_fact_hashes: edge.sourceFactHashes,
      },
      { onConflict: "organization_id,from_key,to_key,kind" },
    );
  }
}
