import { normalizeVerdict, type ClaimRow } from "@/lib/claims/catalog";
import type { ClaimsAssessment } from "@/lib/claims/assess";
import type { Exposure } from "@/lib/scan/exposure";
import type { GithubScan, WebsiteScan } from "@/lib/scan/engine";
import type { DiggerReport } from "@/lib/digger/types";
import type { IntegrityAssessment } from "@/lib/integrity/assess";
import {
  CONNECTOR_STATUS_LABELS,
  DATA_DOMAIN_LABELS,
  connectorsForCountry,
} from "./catalog";
import { entityId, linkIfShared, mergeEntities } from "./entity";
import { moneyConflicts } from "./conflicts";
import { extractOfficersFromText } from "./directors";
import { extractAmounts, formatKes } from "./money";
import type {
  AcquisitionAssessment,
  ConnectorDef,
  ConnectorRuntime,
  ConnectorStatus,
  DataConfidence,
  DataDomain,
  DomainCoverage,
  EvidenceEdge,
  FactConflict,
  FactObservation,
  ResolvedEntity,
} from "./types";

export type VaultDocument = {
  kind: string;
  filename: string;
  sha256: string;
  created_at: string;
  extractedText: string | null;
};

export type AcquireInput = {
  organizationId: string;
  name: string;
  country: string;
  website: WebsiteScan | null;
  github: GithubScan | null;
  exposure: Exposure | null;
  claims: ClaimsAssessment | null;
  documents: VaultDocument[];
  githubToken?: boolean;
  digger?: DiggerReport | null;
  integrity?: IntegrityAssessment | null;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hashFact(parts: string[]) {
  const text = parts.join("|");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function observe(input: {
  entityId: string;
  claim: string;
  value: string;
  connectorId: string;
  sourceType: string;
  access: FactObservation["access"];
  confidence: number;
  sourceRef?: string;
  excerpt?: string;
  amountMinor?: number;
  currency?: string;
  unit?: string;
  periodStart?: string;
  periodEnd?: string;
  stable?: boolean;
}): FactObservation {
  const retrievedAt = new Date().toISOString();
  const hashParts = input.stable
    ? [input.value, input.connectorId, input.claim]
    : [input.value, input.connectorId, retrievedAt.slice(0, 10)];
  return {
    id: `ev:${hashFact([input.entityId, input.claim, input.value, input.connectorId])}`,
    entityId: input.entityId,
    claim: input.claim,
    value: input.value,
    connectorId: input.connectorId,
    sourceType: input.sourceType,
    retrievedAt,
    confidence: input.confidence,
    hash: hashFact(hashParts),
    access: input.access,
    sourceRef: input.sourceRef,
    excerpt: input.excerpt,
    amountMinor: input.amountMinor,
    currency: input.currency,
    unit: input.unit,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  };
}

function vaultHas(documents: VaultDocument[], kinds: string[]) {
  return documents.some((row) => kinds.includes(row.kind));
}

function runtimeStatus(
  def: ConnectorDef,
  input: AcquireInput,
): { status: ConnectorStatus; observed: boolean; reason: string; evidenceCount: number } {
  if (def.id === "ke-website") {
    if (input.website?.reachable) {
      return {
        status: "connected",
        observed: true,
        reason: `Fetched ${input.website.hostname} over ${input.website.https ? "HTTPS" : "HTTP"}.`,
        evidenceCount: 1 + (input.website.storyPages.length ?? 0),
      };
    }
    return {
      status: "unverified",
      observed: false,
      reason: "No public website was fetched this scan.",
      evidenceCount: 0,
    };
  }
  if (def.id === "ke-wikidata") {
    return input.website?.reachable
      ? {
          status: "connected",
          observed: true,
          reason: "Name resolution may have used Wikidata P856, then the site was fetched.",
          evidenceCount: 1,
        }
      : {
          status: "available",
          observed: false,
          reason: "Wikidata is on the resolve path when a URL is not pasted.",
          evidenceCount: 0,
        };
  }
  if (def.id === "ke-dns-tls") {
    if (input.exposure) {
      return {
        status: "connected",
        observed: true,
        reason: `DNS/TLS observed for ${input.exposure.hostname}.`,
        evidenceCount: 1 + (input.exposure.hostnames?.length ?? 0),
      };
    }
    return {
      status: "available",
      observed: false,
      reason: "No hostname to resolve.",
      evidenceCount: 0,
    };
  }
  if (def.id === "ke-github") {
    if (input.github && !input.github.error) {
      return {
        status: "connected",
        observed: true,
        reason: input.githubToken
          ? `GitHub ${input.github.login} connected with a token.`
          : `Public GitHub ${input.github.login} read without a token.`,
        evidenceCount: input.github.repos.length,
      };
    }
    return {
      status: "available",
      observed: false,
      reason: "No GitHub handle on this company. VERIQ does not guess one from the name.",
      evidenceCount: 0,
    };
  }
  if (def.id === "ke-customer-vault") {
    if (input.documents.length) {
      return {
        status: "connected",
        observed: true,
        reason: `${input.documents.length} customer-authorised artefact${input.documents.length === 1 ? "" : "s"} in the vault.`,
        evidenceCount: input.documents.length,
      };
    }
    return {
      status: "customer_consent_required",
      observed: false,
      reason: "Upload a CR12, licence, accounts or bank file — or connect the institution's vault.",
      evidenceCount: 0,
    };
  }
  if (def.id === "ke-brs") {
    if (vaultHas(input.documents, ["cr12", "company_extract"])) {
      return {
        status: "connected",
        observed: true,
        reason: "Directors/ownership read from a customer-uploaded extract. Not a BRS scrape.",
        evidenceCount: 1,
      };
    }
    return {
      status: def.status,
      observed: false,
      reason: def.note,
      evidenceCount: 0,
    };
  }
  if (def.id === "ke-licence-lists") {
    if (vaultHas(input.documents, ["licence"])) {
      return {
        status: "connected",
        observed: true,
        reason: "Licence standing taken from an uploaded artefact, not a regulator scrape.",
        evidenceCount: 1,
      };
    }
    return {
      status: "available",
      observed: false,
      reason: def.note,
      evidenceCount: 0,
    };
  }

  return {
    status: def.status,
    observed: false,
    reason: def.note,
    evidenceCount: 0,
  };
}

function domainNeed(domain: DataDomain): string {
  switch (domain) {
    case "identity":
      return "A public website or an official extract.";
    case "ownership":
      return "Current CR12 / official company extract. BRS is not scraped.";
    case "licensing":
      return "Uploaded licence or an authorised published-list connector.";
    case "digital":
      return "Public website, DNS/TLS, optional GitHub.";
    case "documents":
      return "Kenya Law, Gazette, PPIP — or uploaded contracts and filings.";
    case "adverse":
      return "Sanctions lists, Kenya Law, procurement debarment — once connected. Name match is not a hit.";
    case "relationships":
      return "Shared officers, domains and suppliers once ownership and vault exist.";
    case "customer_vault":
      return "The reviewing desk connects what it already holds.";
    case "finance":
      return "Searchable (not scanned-only) accounts or bank statements. Amounts are never invented.";
  }
}

function pickDomainStatus(statuses: ConnectorStatus[]): ConnectorStatus {
  if (statuses.includes("connected")) return "connected";
  if (statuses.includes("unverified")) return "unverified";
  if (statuses.includes("available")) return "available";
  if (statuses.includes("customer_consent_required")) return "customer_consent_required";
  if (statuses.includes("license_required")) return "license_required";
  return "not_available";
}

function confidence(input: AcquireInput): DataConfidence {
  const identity = input.website?.reachable ? (input.website.https ? 86 : 58) : 22;
  const ownership = vaultHas(input.documents, ["cr12", "company_extract"]) ? 88 : 8;
  const financial = vaultHas(input.documents, ["accounts", "bank_statement", "tax_return"])
    ? 72
    : 10;
  const regulatory = vaultHas(input.documents, ["licence"]) ? 82 : 14;
  const management = (input.website?.teamFootprint ?? 0) >= 3 ? 48 : 12;
  const operations = Math.min(64, 18 + (input.website?.storyPages.length ?? 0) * 8);
  const overall = clamp(
    identity * 0.22 +
      ownership * 0.22 +
      financial * 0.16 +
      regulatory * 0.16 +
      management * 0.12 +
      operations * 0.12,
  );
  return {
    identity: clamp(identity),
    ownership: clamp(ownership),
    financial: clamp(financial),
    regulatory: clamp(regulatory),
    management: clamp(management),
    operations: clamp(operations),
    overall,
  };
}

function factsFromScan(input: AcquireInput, companyId: string): FactObservation[] {
  const country = (input.country || "KE").toUpperCase();
  const rows: FactObservation[] = [];
  if (input.website?.reachable) {
    rows.push(
      observe({
        entityId: companyId,
        claim: "public_hostname",
        value: input.website.hostname,
        connectorId: "ke-website",
        sourceType: "website",
        access: "public_permissioned",
        confidence: 90,
      }),
    );
    rows.push(
      observe({
        entityId: companyId,
        claim: "https",
        value: String(input.website.https),
        connectorId: "ke-website",
        sourceType: "website",
        access: "public_permissioned",
        confidence: 95,
      }),
    );
  }
  if (input.github && !input.github.error) {
    rows.push(
      observe({
        entityId: companyId,
        claim: "github_login",
        value: input.github.login,
        connectorId: "ke-github",
        sourceType: "github",
        access: input.githubToken ? "customer_authorised" : "api",
        confidence: input.githubToken ? 92 : 74,
      }),
    );
  }
  for (const doc of input.documents) {
    rows.push(
      observe({
        entityId: companyId,
        claim: `vault:${doc.kind}`,
        value: doc.filename,
        connectorId: "ke-customer-vault",
        sourceType: "document",
        access: "customer_authorised",
        confidence: 93,
        sourceRef: doc.sha256,
        excerpt: doc.extractedText?.slice(0, 400) || undefined,
      }),
    );
  }
  for (const doc of input.documents) {
    for (const amount of extractAmounts(doc.extractedText, doc.kind, doc.filename)) {
      rows.push(
        observe({
          entityId: companyId,
          claim: `money:${amount.metric}`,
          value: formatKes(amount.amountMinor),
          connectorId: "ke-customer-vault",
          sourceType: doc.kind,
          access: "customer_authorised",
          confidence: 86,
          sourceRef: doc.sha256,
          excerpt: amount.excerpt,
          amountMinor: amount.amountMinor,
          currency: amount.currency,
          unit: "KES",
          periodStart: amount.periodStart,
          periodEnd: amount.periodEnd,
          stable: true,
        }),
      );
    }
    if (doc.kind !== "cr12" && doc.kind !== "company_extract") continue;
    for (const officer of extractOfficersFromText(doc.extractedText)) {
      const personKey = entityId(
        officer.role === "director" ? "director" : "shareholder",
        country,
        officer.name,
      );
      rows.push(
        observe({
          entityId: personKey,
          claim: officer.role === "director" ? "director_name" : "shareholder_name",
          value: officer.name,
          connectorId: "ke-brs",
          sourceType: doc.kind,
          access: "customer_authorised",
          confidence: 84,
          sourceRef: doc.sha256,
          excerpt: officer.excerpt,
          stable: true,
        }),
      );
    }
  }
  for (const claim of input.digger?.claims ?? []) {
    rows.push(
      observe({
        entityId: companyId,
        claim: `digger:${claim.kind}`,
        value: claim.value,
        connectorId: "ke-website",
        sourceType: "digger",
        access: "public_permissioned",
        confidence: Math.min(claim.confidence, 58),
        excerpt: claim.why,
        stable: true,
      }),
    );
    if (claim.verdict === "contradicted" && claim.contradicting[0]) {
      rows.push(
        observe({
          entityId: companyId,
          claim: `digger:${claim.kind}:conflict`,
          value: claim.contradicting[0],
          connectorId: "ke-website",
          sourceType: "digger",
          access: "public_permissioned",
          confidence: Math.min(claim.confidence, 58),
          excerpt: claim.why,
          stable: true,
        }),
      );
    }
  }
  for (const item of input.integrity?.contradictions ?? []) {
    rows.push(
      observe({
        entityId: companyId,
        claim: `integrity:${item.fingerprint}`,
        value: `attested:${item.title}`,
        connectorId: "ke-website",
        sourceType: "integrity",
        access: "public_permissioned",
        confidence: 70,
        excerpt: item.title,
        stable: true,
      }),
      observe({
        entityId: companyId,
        claim: `integrity:${item.fingerprint}:conflict`,
        value: `observed:${item.title}`,
        connectorId: "ke-website",
        sourceType: "integrity",
        access: "public_permissioned",
        confidence: 70,
        excerpt: item.title,
        stable: true,
      }),
    );
  }
  for (const claim of input.claims?.claims ?? []) {
    const verdict = normalizeVerdict(claim.verdict);
    if (verdict === "unknown") continue;
    rows.push(
      observe({
        entityId: companyId,
        claim: claim.id,
        value: `${verdict}: ${claim.claim}`,
        connectorId: claim.domain === "licence" ? "ke-licence-lists" : "ke-website",
        sourceType: "claim",
        access: "public_permissioned",
        confidence: claim.confidence,
      }),
    );
    if (verdict === "contradicted") {
      rows.push(
        observe({
          entityId: companyId,
          claim: `${claim.id}:conflict`,
          value: claim.conflicting[0] ?? claim.why,
          connectorId: claim.domain === "licence" ? "ke-licence-lists" : "ke-website",
          sourceType: "claim",
          access: "public_permissioned",
          confidence: claim.confidence,
          excerpt: claim.why,
          stable: true,
        }),
      );
    }
  }
  return rows;
}

function conflictsFromClaims(claims: ClaimRow[] | undefined, observations: FactObservation[]) {
  const conflicts: FactConflict[] = [];
  for (const claim of claims ?? []) {
    if (normalizeVerdict(claim.verdict) !== "contradicted") continue;
    const left = observations.find((row) => row.claim === claim.id);
    const right = observations.find((row) => row.claim === `${claim.id}:conflict`);
    if (!left || !right) continue;
    conflicts.push({
      claim: claim.title,
      left,
      right,
      why: claim.why,
    });
  }
  return conflicts;
}

function conflictsFromDigger(observations: FactObservation[]) {
  const conflicts: FactConflict[] = [];
  const lefts = observations.filter(
    (row) => row.sourceType === "digger" && !row.claim.endsWith(":conflict"),
  );
  for (const left of lefts) {
    const right = observations.find((row) => row.claim === `${left.claim}:conflict`);
    if (!right) continue;
    conflicts.push({
      claim: left.claim,
      left,
      right,
      why: left.excerpt ?? "Website claim disagrees with another public page. Requires validation.",
    });
  }
  return conflicts;
}

function conflictsFromIntegrity(observations: FactObservation[]) {
  const conflicts: FactConflict[] = [];
  const lefts = observations.filter(
    (row) => row.sourceType === "integrity" && !row.claim.endsWith(":conflict"),
  );
  for (const left of lefts) {
    const right = observations.find((row) => row.claim === `${left.claim}:conflict`);
    if (!right) continue;
    conflicts.push({
      claim: left.claim,
      left,
      right,
      why: `${left.excerpt ?? left.value} — said vs observed. Requires validation. Not a fraud finding.`,
    });
  }
  return conflicts;
}

function coveragePercent(connectors: ConnectorRuntime[]) {
  if (!connectors.length) return 0;
  let have = 0;
  let want = 0;
  for (const row of connectors) {
    if (row.status === "not_available") continue;
    const weight = row.tier === "authoritative" || row.tier === "customer" ? 2 : 1;
    want += weight;
    if (row.status === "connected" && row.observed) have += weight;
    else if (row.status === "connected") have += weight * 0.5;
  }
  return want ? clamp((have / want) * 100) : 0;
}

export function assessAcquisition(input: AcquireInput): AcquisitionAssessment {
  const country = (input.country || "KE").toUpperCase();
  const companyId = entityId("company", country, input.organizationId);
  const defs = connectorsForCountry(country);
  const connectors: ConnectorRuntime[] = defs.map((def) => {
    const run = runtimeStatus(def, input);
    return { ...def, ...run };
  });

  const domains: DomainCoverage[] = (
    [
      "identity",
      "ownership",
      "licensing",
      "digital",
      "documents",
      "adverse",
      "relationships",
      "customer_vault",
      "finance",
    ] as DataDomain[]
  ).map((domain) => {
    const rows = connectors.filter((row) => row.domains.includes(domain));
    return {
      domain,
      status: pickDomainStatus(rows.map((row) => row.status)),
      connectorIds: rows.map((row) => row.id),
      need: domainNeed(domain),
    };
  });

  const vaultOfficers = input.documents.flatMap((doc) =>
    doc.kind === "cr12" || doc.kind === "company_extract"
      ? extractOfficersFromText(doc.extractedText).map((officer) => ({
          ...officer,
          sha256: doc.sha256,
        }))
      : [],
  );

  const entities: ResolvedEntity[] = mergeEntities([
    {
      id: companyId,
      kind: "company",
      label: input.name,
      keys: [
        input.organizationId,
        input.name.toLowerCase(),
        input.website?.hostname ?? "",
        input.github?.login ?? "",
      ].filter(Boolean),
      related: [],
    },
    ...(input.website?.hostname
      ? [
          {
            id: entityId("domain", country, input.website.hostname),
            kind: "domain" as const,
            label: input.website.hostname,
            keys: [input.website.hostname],
            related: [companyId],
          },
        ]
      : []),
    ...input.documents.map((doc) => ({
      id: entityId("document", country, doc.sha256),
      kind: "document" as const,
      label: doc.filename,
      keys: [doc.sha256, doc.kind],
      related: [companyId],
    })),
    ...(input.digger?.people ?? []).map((person) => ({
      id: entityId("person", country, person.name),
      kind: "person" as const,
      label: person.name,
      keys: [person.name.toLowerCase(), person.role.toLowerCase()],
      related: [companyId],
    })),
    ...vaultOfficers.map((officer) => {
      const kind = officer.role === "director" ? ("director" as const) : ("shareholder" as const);
      return {
        id: entityId(kind, country, officer.name),
        kind,
        label: officer.name,
        keys: [officer.name.toLowerCase(), officer.role, officer.sha256],
        related: [companyId],
      };
    }),
  ]);
  for (const a of entities) {
    for (const b of entities) linkIfShared(a, b);
  }

  const observations = factsFromScan(input, companyId);
  const conflicts = [
    ...conflictsFromClaims(input.claims?.claims, observations),
    ...conflictsFromDigger(observations),
    ...conflictsFromIntegrity(observations),
    ...moneyConflicts(observations),
  ];
  const edges: EvidenceEdge[] = [];
  for (const person of input.digger?.people ?? []) {
    const personKey = entityId("person", country, person.name);
    edges.push({
      fromKey: personKey,
      toKey: companyId,
      kind: "mentioned_in",
      confidence: 28,
      validationStatus: "requires_validation",
      why: `${person.name} named as ${person.role} on the company site. Not a CR12 director.`,
      sourceFactHashes: [],
    });
  }
  for (const officer of vaultOfficers) {
    const officerKey = entityId(
      officer.role === "director" ? "director" : "shareholder",
      country,
      officer.name,
    );
    edges.push({
      fromKey: officerKey,
      toKey: companyId,
      kind: officer.role === "director" ? "director_of" : "shareholder_of",
      confidence: 84,
      validationStatus: "pending",
      why: `${officer.name} parsed as ${officer.role} from an authorised ownership extract text layer. Confirm against the original file.`,
      sourceFactHashes: [],
    });
  }
  for (const entity of entities) {
    if (entity.kind !== "person" && entity.kind !== "director") continue;
    const vaultHit = input.documents.some((doc) =>
      (doc.extractedText ?? "").toLowerCase().includes(entity.label.toLowerCase()),
    );
    if (!vaultHit) continue;
    if (entity.kind === "director") continue;
    edges.push({
      fromKey: entity.id,
      toKey: companyId,
      kind: "related_party",
      confidence: 41,
      validationStatus: "requires_validation",
      why: `${entity.label} appears on the website and in an authorised vault artefact. Possible related-party relationship. Requires human validation.`,
      sourceFactHashes: [],
    });
  }
  const conf = confidence(input);
  const coverage = coveragePercent(connectors);
  const connected = connectors.filter((row) => row.status === "connected").length;
  const available = connectors.filter((row) => row.status === "available").length;
  const blocked = connectors.filter(
    (row) =>
      row.status === "license_required" ||
      row.status === "customer_consent_required" ||
      row.status === "not_available",
  ).length;

  const missingDomains = domains
    .filter((row) => row.status !== "connected")
    .map((row) => DATA_DOMAIN_LABELS[row.domain]);

  const summary =
    coverage < 40
      ? `Coverage ${coverage}%. Data confidence ${conf.overall}%. Connected: website and public DNS if they answered. ${missingDomains.slice(0, 4).join(", ")} stay ${CONNECTOR_STATUS_LABELS[domains.find((row) => row.domain === "ownership")?.status ?? "customer_consent_required"]}. This is not a clearance.`
      : `Coverage ${coverage}%. Data confidence ${conf.overall}% is independent of the risk score. ${connected} connector${connected === 1 ? "" : "s"} live. Competing observations are kept, not overwritten.`;

  return {
    country,
    coverage,
    connected,
    available,
    blocked,
    connectors,
    domains,
    entities,
    observations,
    conflicts,
    edges,
    confidence: conf,
    summary,
  };
}

export function emptyAcquisition(country = "KE"): AcquisitionAssessment {
  return assessAcquisition({
    organizationId: "preview",
    name: "Unnamed company",
    country,
    website: null,
    github: null,
    exposure: null,
    claims: null,
    documents: [],
  });
}
