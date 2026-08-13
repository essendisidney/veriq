"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attestAi, declareAiSystem } from "@/lib/actions/ai";
import {
  AI_CATEGORY_LABELS,
  assessAi,
  parseAttestedAi,
  systemFromAsset,
  type AiAssessment,
  type AttestedAi,
  type TriState,
} from "@/lib/ai/assess";
import { AI_CATEGORIES } from "@/lib/ai/catalog";
import type { VendorMap } from "@/lib/vendors/assess";
import { TRUST_LABELS } from "@/lib/utils";

const TRI: { value: TriState; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export default function AiPage() {
  const { currentOrg } = useWorkspace();
  const [ai, setAi] = useState<AiAssessment | null>(null);
  const [attested, setAttested] = useState<AttestedAi | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const [{ data: scans }, { data: systems }, { data: governance }] = await Promise.all([
      supabase
        .from("scans")
        .select("summary")
        .eq("organization_id", currentOrg.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("assets")
        .select("name, metadata")
        .eq("organization_id", currentOrg.id)
        .eq("type", "ai"),
      supabase
        .from("assets")
        .select("metadata")
        .eq("organization_id", currentOrg.id)
        .eq("type", "ai_governance")
        .eq("name", "AI governance")
        .maybeSingle(),
    ]);
    const summary = scans?.[0]?.summary as
      | { ai?: AiAssessment; vendors?: VendorMap }
      | undefined;
    const nextAttested = parseAttestedAi(governance?.metadata);
    const declared = (systems ?? []).flatMap((row) => {
      const system = systemFromAsset(row);
      return system ? [system] : [];
    });
    setAttested(nextAttested);
    setAi(
      assessAi({
        detected: summary?.ai?.systems.filter((item) => item.origin === "observed") ?? [],
        declared,
        attested: nextAttested,
      }),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function onDeclare(formData: FormData) {
    if (!currentOrg) return;
    setSaving(true);
    setMessage(null);
    const result = await declareAiSystem({
      organizationId: currentOrg.id,
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? "other"),
      processesData: formData.get("processesData") === "on",
    });
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Declared. Rescan to fold this into the VERIQ Score.");
    await load();
  }

  async function onAttest(formData: FormData) {
    if (!currentOrg) return;
    setSaving(true);
    setMessage(null);
    const result = await attestAi({
      organizationId: currentOrg.id,
      inventory: String(formData.get("inventory") ?? "unknown"),
      humanOversight: String(formData.get("humanOversight") ?? "unknown"),
      decisionLogging: String(formData.get("decisionLogging") ?? "unknown"),
      customerFacing: String(formData.get("customerFacing") ?? "unknown"),
      trainsOnCustomerData: String(formData.get("trainsOnCustomerData") ?? "unknown"),
      biasTesting: String(formData.get("biasTesting") ?? "unknown"),
      modelMonitoring: String(formData.get("modelMonitoring") ?? "unknown"),
      dataProvenance: String(formData.get("dataProvenance") ?? "unknown"),
      accessControls: String(formData.get("accessControls") ?? "unknown"),
    });
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Saved. Rescan to fold this into the VERIQ Score.");
    await load();
  }

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader
        title="AI governance"
        description="Observed models and SDKs, plus attested oversight. VERIQ will not assume ChatGPT or Copilot is absent — or that governance exists."
      />

      {!ai ? (
        <EmptyState
          icon={Sparkles}
          title="No AI signal yet"
          description="Run a scan, or declare a system. Oversight stays UNKNOWN until attested."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Posture" value={String(ai.posture)} />
            <Stat label="Systems" value={String(ai.systems.length)} />
            <Stat label="Unknowns" value={String(ai.unknowns.length)} />
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">{ai.summary}</p>

          {ai.systems.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No systems mapped"
              description="Declare production models, coding assistants or agent frameworks."
              className="py-10"
            />
          ) : (
            <div className="grid gap-4">
              {ai.systems.map((system) => (
                <div
                  key={system.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl">{system.name}</h2>
                    <Badge variant="muted">{AI_CATEGORY_LABELS[system.category]}</Badge>
                    <Badge variant={system.origin === "observed" ? "accent" : "muted"}>
                      {system.origin}
                    </Badge>
                    <Badge variant="muted">{TRUST_LABELS[system.trustStatus]}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {system.processesData ? "May process prompts or customer data" : "Data processing not inferred"}
                    {system.sources.length
                      ? ` · ${system.sources.map((item) => item.reference).join(", ")}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          <form
            action={onDeclare}
            className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2"
          >
            <h2 className="font-display text-xl sm:col-span-2">Declare a system</h2>
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="OpenAI, Copilot, internal LLM…" />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                defaultValue="other"
                className="flex h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
              >
                {AI_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {AI_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end text-sm text-[var(--muted)]">
              <input type="checkbox" name="processesData" defaultChecked />
              Processes prompts or customer data
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                Add to inventory
              </Button>
            </div>
          </form>

          <form
            action={onAttest}
            className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2"
          >
            <h2 className="font-display text-xl sm:col-span-2">Attest governance</h2>
            <p className="sm:col-span-2 text-sm text-[var(--muted)]">
              Qualitative only. Do not paste prompts, policies or model weights.
            </p>
            <Field id="inventory" label="AI inventory exists" defaultValue={attested?.inventory ?? "unknown"} />
            <Field
              id="humanOversight"
              label="Human oversight for material decisions"
              defaultValue={attested?.humanOversight ?? "unknown"}
            />
            <Field
              id="decisionLogging"
              label="Decision / output logging"
              defaultValue={attested?.decisionLogging ?? "unknown"}
            />
            <Field
              id="customerFacing"
              label="Customer-facing AI"
              defaultValue={attested?.customerFacing ?? "unknown"}
            />
            <Field
              id="trainsOnCustomerData"
              label="Vendor may train on our data"
              defaultValue={attested?.trainsOnCustomerData ?? "unknown"}
            />
            <Field
              id="biasTesting"
              label="Bias testing"
              defaultValue={attested?.biasTesting ?? "unknown"}
            />
            <Field
              id="modelMonitoring"
              label="Model monitoring"
              defaultValue={attested?.modelMonitoring ?? "unknown"}
            />
            <Field
              id="dataProvenance"
              label="Training-data provenance"
              defaultValue={attested?.dataProvenance ?? "unknown"}
            />
            <Field
              id="accessControls"
              label="Access controls on models / prompts"
              defaultValue={attested?.accessControls ?? "unknown"}
            />
            {message && <p className="sm:col-span-2 text-sm text-[var(--muted)]">{message}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save attested governance"}
              </Button>
            </div>
          </form>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Still UNKNOWN</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {ai.unknowns.map((item) => (
                <li key={item}>
                  <Badge variant="muted">{item}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </div>
  );
}

function Field({
  id,
  label,
  defaultValue,
}: {
  id: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="flex h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
      >
        {TRI.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
