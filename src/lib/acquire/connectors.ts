import type { AccessMethod, ConnectorStatus } from "@/lib/acquire/types";

export type RegistryLight = "to_connect" | "starter" | "connected";

export type KenyaSource = {
  id: string;
  source: string;
  data: string;
  access: string;
  connectorIds: string[];
  starter: boolean;
};

export const KENYA_SOURCE_REGISTRY: KenyaSource[] = [
  {
    id: "corporate-registry",
    source: "Corporate Registry",
    data: "Directors / ownership / status",
    access: "API / licensed / authorised extract",
    connectorIds: ["ke-brs"],
    starter: false,
  },
  {
    id: "regulators",
    source: "Regulators",
    data: "Licences / compliance",
    access: "API / data agreement",
    connectorIds: ["ke-licence-lists"],
    starter: false,
  },
  {
    id: "procurement",
    source: "Procurement",
    data: "Tenders / contracts",
    access: "Permitted source",
    connectorIds: ["ke-ppip"],
    starter: false,
  },
  {
    id: "courts",
    source: "Courts",
    data: "Litigation",
    access: "Authorised source",
    connectorIds: ["ke-kenya-law"],
    starter: false,
  },
  {
    id: "credit-bureau",
    source: "Credit bureau",
    data: "Credit / financial intelligence",
    access: "Commercial agreement",
    connectorIds: ["ke-credit-bureau"],
    starter: false,
  },
  {
    id: "public-web",
    source: "Public web",
    data: "Claims / reputation / digital identity",
    access: "Permitted public sources",
    connectorIds: ["ke-website", "ke-wikidata", "ke-dns-tls", "ke-github"],
    starter: true,
  },
  {
    id: "customer-data",
    source: "Customer data",
    data: "Accounts / statements / contracts / CR12",
    access: "Consent / upload / API",
    connectorIds: ["ke-customer-vault"],
    starter: true,
  },
];

export const REGISTRY_LIGHT_LABELS: Record<RegistryLight, string> = {
  to_connect: "To connect",
  starter: "Starter",
  connected: "Connected",
};

export function registryLight(input: {
  starter: boolean;
  connectorStatus: ConnectorStatus;
  observed: boolean;
}): RegistryLight {
  if (input.observed && input.connectorStatus === "connected") return "connected";
  if (input.starter) return "starter";
  return "to_connect";
}

export type ConnectorObservation = {
  claim: string;
  value: string;
  confidence: number;
  sourceType: string;
  sourceRef?: string;
  excerpt?: string;
  access: AccessMethod;
};

export type ConnectorRunResult = {
  connectorId: string;
  status: ConnectorStatus;
  observed: boolean;
  note: string;
  observations: ConnectorObservation[];
};

export type ConnectorContext = {
  organizationId: string;
  name: string;
  country: string;
  websiteHostname: string | null;
  websiteHttps: boolean | null;
  websiteReachable: boolean;
  storyPageCount: number;
  githubLogin: string | null;
  documents: { kind: string; filename: string; sha256: string; extractedText: string | null }[];
};

export type DataConnector = {
  id: string;
  run(ctx: ConnectorContext): ConnectorRunResult;
};
