export const CONNECTOR_TIERS = ["authoritative", "commercial", "public_web", "customer"] as const;
export type ConnectorTier = (typeof CONNECTOR_TIERS)[number];

export const CONNECTOR_STATUSES = [
  "connected",
  "available",
  "license_required",
  "customer_consent_required",
  "not_available",
  "unverified",
] as const;
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

export const ACCESS_METHODS = [
  "api",
  "partnership",
  "customer_authorised",
  "public_permissioned",
  "refused",
] as const;
export type AccessMethod = (typeof ACCESS_METHODS)[number];

export const DATA_DOMAINS = [
  "identity",
  "ownership",
  "licensing",
  "digital",
  "documents",
  "adverse",
  "relationships",
  "customer_vault",
  "finance",
] as const;
export type DataDomain = (typeof DATA_DOMAINS)[number];

export const ENTITY_KINDS = [
  "company",
  "person",
  "director",
  "shareholder",
  "address",
  "phone",
  "email",
  "domain",
  "licence",
  "document",
  "supplier",
  "branch",
  "customer",
  "account",
  "transaction",
  "policy",
  "control",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export type ConnectorDef = {
  id: string;
  name: string;
  country: string;
  authority: string;
  tier: ConnectorTier;
  access: AccessMethod;
  /** Default legal/commercial posture. Runtime may upgrade to connected. */
  status: ConnectorStatus;
  domains: DataDomain[];
  reliability: number;
  refresh: string;
  cost: string;
  permission: string;
  note: string;
  sourceUrl: string | null;
};

export type ConnectorRuntime = ConnectorDef & {
  observed: boolean;
  evidenceCount: number;
  reason: string;
};

export type FactObservation = {
  id: string;
  entityId: string;
  claim: string;
  value: string;
  connectorId: string;
  sourceType: string;
  sourceRef?: string;
  excerpt?: string;
  retrievedAt: string;
  confidence: number;
  hash: string;
  access: AccessMethod;
  amountMinor?: number;
  currency?: string;
  unit?: string;
  periodStart?: string;
  periodEnd?: string;
};

export type FactConflict = {
  claim: string;
  left: FactObservation;
  right: FactObservation;
  why: string;
  variancePct?: number;
};

export type EvidenceEdge = {
  fromKey: string;
  toKey: string;
  kind: string;
  confidence: number;
  validationStatus: "requires_validation" | "pending";
  why: string;
  sourceFactHashes: string[];
};

export type ResolvedEntity = {
  id: string;
  kind: EntityKind;
  label: string;
  keys: string[];
  related: string[];
};

export type DomainCoverage = {
  domain: DataDomain;
  status: ConnectorStatus;
  connectorIds: string[];
  need: string;
};

export type DataConfidence = {
  identity: number;
  ownership: number;
  financial: number;
  regulatory: number;
  management: number;
  operations: number;
  overall: number;
};

export type AcquisitionAssessment = {
  country: string;
  coverage: number;
  connected: number;
  available: number;
  blocked: number;
  connectors: ConnectorRuntime[];
  domains: DomainCoverage[];
  entities: ResolvedEntity[];
  observations: FactObservation[];
  conflicts: FactConflict[];
  edges?: EvidenceEdge[];
  confidence: DataConfidence;
  summary: string;
};
