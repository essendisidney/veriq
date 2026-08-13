"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { declareVendor } from "@/lib/actions/vendors";
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABELS,
  type VendorCategory,
} from "@/lib/vendors/catalog";
import { declaredFromAsset } from "@/lib/vendors/detect";
import type { VendorMap } from "@/lib/vendors/assess";
import { assessVendors } from "@/lib/vendors/assess";
import type { AssetCriticality } from "@/lib/database.types";

export default function VendorsPage() {
  const { currentOrg } = useWorkspace();
  const [map, setMap] = useState<VendorMap | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const [{ data: scans }, { data: assets }] = await Promise.all([
      supabase
        .from("scans")
        .select("summary")
        .eq("organization_id", currentOrg.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("assets")
        .select("name, criticality, metadata")
        .eq("organization_id", currentOrg.id)
        .eq("type", "vendor"),
    ]);
    const summary = scans?.[0]?.summary as { vendors?: VendorMap } | undefined;
    const declared = (assets ?? []).flatMap((row) => {
      const vendor = declaredFromAsset(row);
      return vendor ? [vendor] : [];
    });
    const scanned = summary?.vendors;
    if (scanned) {
      const extra = declared.filter(
        (item) => !scanned.vendors.some((vendor) => vendor.id === item.id),
      );
      const extras = extra.length
        ? assessVendors({ detected: [], declared: extra }).vendors
        : [];
      setMap({
        ...scanned,
        vendors: [...scanned.vendors, ...extras],
      });
    } else {
      setMap(assessVendors({ detected: [], declared }));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function onDeclare(formData: FormData) {
    if (!currentOrg) return;
    setSaving(true);
    setError(null);
    const result = await declareVendor({
      organizationId: currentOrg.id,
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? "other") as VendorCategory,
      criticality: String(formData.get("criticality") ?? "medium") as AssetCriticality,
      processesData: formData.get("processesData") === "on",
      connectsToProduction: formData.get("connectsToProduction") === "on",
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    await load();
  }

  const vendors = map?.vendors ?? [];

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Observed from the public site and package manifests, plus vendors you declare. Intelligence, not a due-diligence opinion."
        actions={
          <Button variant="secondary" onClick={() => setOpen((value) => !value)}>
            Declare vendor
          </Button>
        }
      />

      {open && currentOrg && (
        <form
          className="mb-6 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2"
          action={onDeclare}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="name">Vendor name</Label>
            <Input id="name" name="name" required placeholder="Stripe, Paystack, AWS…" />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              name="category"
              defaultValue="other"
              className="flex h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
            >
              {VENDOR_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {VENDOR_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="criticality">Criticality</Label>
            <select
              id="criticality"
              name="criticality"
              defaultValue="medium"
              className="flex h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" name="processesData" defaultChecked />
            Processes our data
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" name="connectsToProduction" />
            Connects to production
          </label>
          {error && <p className="sm:col-span-2 text-sm text-[var(--critical)]">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add to register"}
            </Button>
          </div>
        </form>
      )}

      {map && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <Stat label="Vendors" value={String(vendors.length)} />
          <Stat label="Critical / high" value={String(map.criticalCount)} />
          <Stat label="Data processors" value={String(map.dataProcessors)} />
          <Stat label="Unknown answers" value={String(map.unknownAnswers)} />
        </div>
      )}

      {vendors.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No vendors mapped"
          description="Run a scan with a website or GitHub source, or declare a critical vendor."
        />
      ) : (
        <div className="grid gap-4">
          {vendors.map((vendor) => (
            <Link
              key={vendor.id}
              href={`/vendors/${vendor.id}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{vendor.name}</h2>
                <Badge variant="muted">{VENDOR_CATEGORY_LABELS[vendor.category]}</Badge>
                <Badge>{vendor.criticality}</Badge>
                <SeverityBadge severity={vendor.risk} />
                <Badge variant={vendor.origin === "observed" ? "accent" : "muted"}>
                  {vendor.origin}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{vendor.reason}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {vendor.questions.filter((item) => item.status === "unknown").length} unknown
                artefacts
                {vendor.processesData ? " · processes data" : ""}
                {vendor.connectsToProduction ? " · production path" : ""}
              </p>
            </Link>
          ))}
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
