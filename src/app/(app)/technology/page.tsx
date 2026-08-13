"use client";

import { useEffect, useState } from "react";
import { Server } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate, scoreTone } from "@/lib/utils";
import type { Domain, Json } from "@/lib/database.types";
import type { Exposure } from "@/lib/scan/exposure";

function asExposure(value: Json | undefined): Exposure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.posture !== "number" || typeof record.hostname !== "string") {
    return null;
  }
  return value as unknown as Exposure;
}

export default function TechnologyPage() {
  const { currentOrg } = useWorkspace();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [exposure, setExposure] = useState<Exposure | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const [{ data: domainRows }, { data: scans }] = await Promise.all([
        supabase
          .from("domains")
          .select("*")
          .eq("organization_id", currentOrg!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("scans")
          .select("summary")
          .eq("organization_id", currentOrg!.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      setDomains((domainRows as Domain[]) ?? []);
      const summary = scans?.[0]?.summary as Record<string, Json> | undefined;
      setExposure(asExposure(summary?.exposure));
    }
    void load();
  }, [currentOrg]);

  const tone = exposure ? scoreTone(exposure.posture) : "ok";
  const toneColor =
    tone === "good"
      ? "var(--good)"
      : tone === "ok"
        ? "var(--low)"
        : tone === "warn"
          ? "var(--medium)"
          : "var(--critical)";

  return (
    <div>
      <PageHeader
        title="Technology"
        description="Publicly observable exposure: DNS, TLS, email authentication and certificate-transparency hostnames."
      />
      {domains.length === 0 && !exposure ? (
        <EmptyState
          icon={Server}
          title="No domains discovered"
          description="Add a website on the company profile and run a scan."
        />
      ) : (
        <div className="space-y-6">
          {exposure && (
            <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Exposure posture
                </p>
                <p
                  className="mt-3 font-display text-6xl leading-none"
                  style={{ color: toneColor }}
                >
                  {exposure.posture}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">/ 100</p>
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Higher is better. Built from TLS, DNS and public hostname evidence.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Fact
                  label="TLS"
                  value={
                    exposure.tls
                      ? `${exposure.tls.daysRemaining ?? "—"} days left`
                      : "Not observed"
                  }
                  hint={
                    exposure.tls?.issuer
                      ? `${exposure.tls.issuer}${exposure.tls.validTo ? ` · ${formatDate(exposure.tls.validTo)}` : ""}`
                      : undefined
                  }
                />
                <Fact
                  label="HTTPS redirect"
                  value={
                    exposure.httpsRedirect === null
                      ? "Unknown"
                      : exposure.httpsRedirect
                        ? "HTTP → HTTPS"
                        : "Missing"
                  }
                />
                <Fact
                  label="SPF"
                  value={exposure.spf ? "Present" : "Missing"}
                />
                <Fact
                  label="DMARC"
                  value={
                    exposure.dmarc
                      ? `Present (${exposure.dmarcPolicy})`
                      : "Missing"
                  }
                />
                <Fact
                  label="security.txt"
                  value={exposure.securityTxt ? "Present" : "Not found"}
                />
                <Fact
                  label="Public hostnames"
                  value={String(exposure.hostnames.length)}
                />
              </div>
            </section>
          )}

          {domains.map((domain) => (
            <article
              key={domain.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{domain.hostname}</h2>
                <Badge variant={domain.https ? "accent" : "danger"}>
                  {domain.https ? "HTTPS" : "No HTTPS"}
                </Badge>
                {domain.status_code && (
                  <Badge variant="muted">{domain.status_code}</Badge>
                )}
              </div>
              <p className="mt-2 break-all text-sm text-[var(--muted)]">
                {domain.url}
              </p>
              {domain.technologies.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {domain.technologies.map((tech) => (
                    <Badge key={tech}>{tech}</Badge>
                  ))}
                </div>
              )}
              {exposure?.dns && (
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      A / AAAA
                    </dt>
                    <dd className="mt-1 text-[var(--ink)]">
                      {[...exposure.dns.a, ...exposure.dns.aaaa].join(", ") ||
                        "None"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      MX
                    </dt>
                    <dd className="mt-1 text-[var(--ink)]">
                      {exposure.dns.mx.join(", ") || "None"}
                    </dd>
                  </div>
                </dl>
              )}
            </article>
          ))}

          {exposure && exposure.hostnames.length > 0 && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-2xl">Certificate hostnames</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Names observed in public certificate transparency for this domain.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {exposure.hostnames.map((host) => (
                  <Badge key={host} variant="muted">
                    {host}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--ink)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
