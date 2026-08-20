import type { ConnectorContext, ConnectorRunResult, DataConnector } from "./connectors";
import { extractOfficersFromText } from "./directors";

export const webIntelligenceConnector: DataConnector = {
  id: "ke-website",
  run(ctx) {
    if (!ctx.websiteReachable || !ctx.websiteHostname) {
      return {
        connectorId: this.id,
        status: "unverified",
        observed: false,
        note: "No public website was fetched. Paste a URL or let name resolution find one.",
        observations: [],
      };
    }
    return {
      connectorId: this.id,
      status: "connected",
      observed: true,
      note: `Public site ${ctx.websiteHostname} fetched. This is a claim surface, not a CR12.`,
      observations: [
        {
          claim: "public_hostname",
          value: ctx.websiteHostname,
          confidence: 90,
          sourceType: "website",
          sourceRef: `https://${ctx.websiteHostname}`,
          access: "public_permissioned",
        },
        {
          claim: "https",
          value: String(Boolean(ctx.websiteHttps)),
          confidence: 95,
          sourceType: "website",
          access: "public_permissioned",
        },
        {
          claim: "story_pages",
          value: String(ctx.storyPageCount),
          confidence: 80,
          sourceType: "website",
          access: "public_permissioned",
        },
      ],
    };
  },
};

export const customerDataConnector: DataConnector = {
  id: "ke-customer-vault",
  run(ctx) {
    if (!ctx.documents.length) {
      return {
        connectorId: this.id,
        status: "customer_consent_required",
        observed: false,
        note: "Upload a CR12, licence, accounts or bank file. VERIQ does not fetch the vault.",
        observations: [],
      };
    }
    return {
      connectorId: this.id,
      status: "connected",
      observed: true,
      note: `${ctx.documents.length} customer-authorised artefact(s). Contents are evidence, not a conclusion.`,
      observations: ctx.documents.map((doc) => ({
        claim: `vault:${doc.kind}`,
        value: doc.filename,
        confidence: 93,
        sourceType: "document",
        sourceRef: doc.sha256,
        excerpt: doc.extractedText?.slice(0, 400) || undefined,
        access: "customer_authorised" as const,
      })),
    };
  },
};

function stub(
  id: string,
  note: string,
  status: ConnectorRunResult["status"] = "available",
): DataConnector {
  return {
    id,
    run() {
      return {
        connectorId: id,
        status,
        observed: false,
        note,
        observations: [],
      };
    },
  };
}

export const brsConnector: DataConnector = {
  id: "ke-brs",
  run(ctx) {
    const extract = ctx.documents.find(
      (doc) => doc.kind === "cr12" || doc.kind === "company_extract",
    );
    if (extract) {
      const officers = extractOfficersFromText(extract.extractedText);
      const directors = officers.filter((row) => row.role === "director");
      const shareholders = officers.filter((row) => row.role === "shareholder");
      return {
        connectorId: this.id,
        status: "connected",
        observed: true,
        note: directors.length
          ? `Ownership path is the uploaded extract, not a BRS scrape. Parsed ${directors.length} director name(s)${shareholders.length ? ` and ${shareholders.length} shareholder name(s)` : ""} from the text layer.`
          : "Ownership path is the uploaded extract, not a BRS scrape. No director names parsed from the text layer — upload a searchable CR12 or attest officers.",
        observations: [
          {
            claim: "ownership_artefact",
            value: extract.filename,
            confidence: 88,
            sourceType: "document",
            sourceRef: extract.sha256,
            excerpt: extract.extractedText?.slice(0, 400) || undefined,
            access: "customer_authorised",
          },
          ...officers.map((row) => ({
            claim: row.role === "director" ? "director_name" : "shareholder_name",
            value: row.name,
            confidence: 84,
            sourceType: "document" as const,
            sourceRef: extract.sha256,
            excerpt: row.excerpt,
            access: "customer_authorised" as const,
          })),
        ],
      };
    }
    return {
      connectorId: this.id,
      status: "customer_consent_required",
      observed: false,
      note: "BRS / eCitizen is not scraped. Plug an official API or upload a CR12. get_directors() will then fill the same fact table.",
      observations: [],
    };
  },
};

export const licenceListConnector = stub(
  "ke-licence-lists",
  "CBK / CMA / IRA published lists are not ingested yet. Upload a licence, or connect an authorised list feed. A checkout button is not a licence.",
);
export const procurementConnector = stub(
  "ke-ppip",
  "PPIP / PPRA is not scraped. A permitted procurement connector plugs in here later.",
);
export const courtConnector = stub(
  "ke-kenya-law",
  "Kenya Law / Gazette is not ingested yet. A name match will never be stored as a finding of guilt.",
);
export const creditBureauConnector = stub(
  "ke-credit-bureau",
  "Licensed bureau access requires a commercial agreement. VERIQ will not scrape credit files.",
  "license_required",
);
export const githubPublicConnector: DataConnector = {
  id: "ke-github",
  run(ctx) {
    if (!ctx.githubLogin) {
      return {
        connectorId: this.id,
        status: "available",
        observed: false,
        note: "No GitHub handle. VERIQ does not guess one from the company name.",
        observations: [],
      };
    }
    return {
      connectorId: this.id,
      status: "connected",
      observed: true,
      note: `Public GitHub ${ctx.githubLogin} is an engineering footprint, not headcount.`,
      observations: [
        {
          claim: "github_login",
          value: ctx.githubLogin,
          confidence: 74,
          sourceType: "github",
          access: "api",
        },
      ],
    };
  },
};

export const KENYA_CONNECTOR_RUNTIME: DataConnector[] = [
  webIntelligenceConnector,
  githubPublicConnector,
  customerDataConnector,
  brsConnector,
  licenceListConnector,
  procurementConnector,
  courtConnector,
  creditBureauConnector,
];

export function runKenyaConnectors(ctx: ConnectorContext): ConnectorRunResult[] {
  return KENYA_CONNECTOR_RUNTIME.map((connector) => connector.run(ctx));
}
