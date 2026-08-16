export const WORLD_KINDS = [
  "regulatory",
  "vendor",
  "industry",
  "cyber",
  "government",
  "market",
  "integrity",
] as const;

export type WorldKind = (typeof WORLD_KINDS)[number];

export type WorldDef = {
  id: string;
  title: string;
  kind: WorldKind;
  summary: string;
  jurisdictions: string[] | "*";
  industries: string[] | "*";
  vendorIds?: string[];
  regulationCodes?: string[];
  needsAi?: boolean;
  needsGithub?: boolean;
  needsWeakEmailAuth?: boolean;
  needsPayment?: boolean;
  needsHost?: boolean;
};

export const WORLD_KIND_LABELS: Record<WorldKind, string> = {
  regulatory: "Regulatory",
  vendor: "Vendor / supply chain",
  industry: "Industry",
  cyber: "Cyber",
  government: "Government",
  market: "Market",
  integrity: "Integrity",
};

export const WORLD_CATALOG: WorldDef[] = [
  {
    id: "ke-insolvency-regime",
    title: "Kenya Insolvency Act standing duties",
    kind: "regulatory",
    summary:
      "The Insolvency Act, 2015 remains in force. Books of account, a statement of affairs and cooperation with an insolvency practitioner are standing duties — not a claim that this company is insolvent.",
    jurisdictions: ["KE"],
    industries: "*",
    regulationCodes: ["KE-IA"],
  },
  {
    id: "ke-advocates-conduct",
    title: "Advocates Act / LSK professional conduct",
    kind: "regulatory",
    summary:
      "Practising certificate, client-account and professional-conduct expectations remain in force for Kenyan advocates. Whether this firm holds current standing is UNKNOWN until attested. This is not a disciplinary finding.",
    jurisdictions: ["KE"],
    industries: ["professional_services"],
    regulationCodes: ["KE-ADV"],
  },
  {
    id: "odpc-notification",
    title: "ODPC breach-notification expectation",
    kind: "regulatory",
    summary:
      "The Kenya Data Protection Act remains in force. Controllers are expected to notify the Office of the Data Protection Commissioner of notifiable personal-data breaches. Whether this company has a playbook is UNKNOWN until attested.",
    jurisdictions: ["KE"],
    industries: "*",
    regulationCodes: ["KE-DPA"],
  },
  {
    id: "cbk-cyber-supervision",
    title: "CBK cybersecurity supervision",
    kind: "regulatory",
    summary:
      "The Central Bank of Kenya publishes cybersecurity guidance for supervised institutions. Incident response and third-party risk remain a standing supervisory theme — not a one-off headline.",
    jurisdictions: ["KE"],
    industries: ["fintech", "financial_services", "insurance"],
    regulationCodes: ["KE-CBK-CYBER"],
  },
  {
    id: "nps-payments-perimeter",
    title: "Kenya payment-system perimeter",
    kind: "regulatory",
    summary:
      "The National Payment System Act governs payment service providers and electronic money in Kenya. Operating a customer payment rail without a clear licence perimeter is a standing regulatory condition.",
    jurisdictions: ["KE"],
    industries: ["fintech", "financial_services"],
    regulationCodes: ["KE-NPS"],
    needsPayment: true,
  },
  {
    id: "eac-data-transfers",
    title: "East African personal-data transfer conditions",
    kind: "government",
    summary:
      "Kenya, Uganda and Tanzania each have a data-protection statute. Cross-border processing inside East Africa still requires a lawful basis and adequate safeguards. Whether this company transfers data across those borders is UNKNOWN.",
    jurisdictions: ["KE", "UG", "TZ", "RW"],
    industries: "*",
  },
  {
    id: "eu-ai-act",
    title: "EU AI Act deployer obligations",
    kind: "regulatory",
    summary:
      "The EU AI Act is a standing public statute for providers and deployers of AI systems offered in the Union. Whether this company places a system on the EU market is UNKNOWN.",
    jurisdictions: "*",
    industries: "*",
    needsAi: true,
  },
  {
    id: "dora-ict",
    title: "DORA-class ICT concentration (EU finance)",
    kind: "regulatory",
    summary:
      "The EU Digital Operational Resilience Act is a standing ICT and third-party resilience regime for financial entities. Whether this company is in scope as an EU financial entity, or as a critical ICT provider to one, is UNKNOWN.",
    jurisdictions: "*",
    industries: ["fintech", "financial_services", "insurance"],
  },
  {
    id: "hyperscaler-concentration",
    title: "Hyperscaler concentration",
    kind: "vendor",
    summary:
      "Public cloud regions fail. If production is concentrated on a single observed host, a regional disruption is a business-continuity event — VERIQ will not invent that an outage is happening now.",
    jurisdictions: "*",
    industries: "*",
    vendorIds: ["aws", "google-cloud", "vercel", "netlify", "cloudflare"],
    needsHost: true,
  },
  {
    id: "payment-rail-disruption",
    title: "Payment-rail disruption class",
    kind: "vendor",
    summary:
      "Customer collections sit on observed payment processors. A processor outage or scheme incident would interrupt revenue. Amounts remain UNKNOWN.",
    jurisdictions: "*",
    industries: "*",
    vendorIds: ["stripe", "paypal", "paystack", "flutterwave", "mpesa", "pesapal"],
    needsPayment: true,
  },
  {
    id: "identity-provider",
    title: "Identity-provider dependency",
    kind: "vendor",
    summary:
      "Login concentrated on a hosted identity vendor is an availability and account-takeover path. Substitution was not attested.",
    jurisdictions: "*",
    industries: "*",
    vendorIds: ["auth0", "clerk"],
  },
  {
    id: "foundation-model-api",
    title: "Foundation-model API dependency",
    kind: "vendor",
    summary:
      "Prompts and possibly customer data leave the perimeter when a foundation-model API is observed. Contractual training opt-out and residency stay UNKNOWN.",
    jurisdictions: "*",
    industries: "*",
    vendorIds: ["openai", "anthropic"],
    needsAi: true,
  },
  {
    id: "email-auth-spoofing",
    title: "Domain spoofing without email authentication",
    kind: "cyber",
    summary:
      "Without observed SPF and DMARC, the public domain can be used to impersonate the company. This is a standing internet condition, not a claimed incident.",
    jurisdictions: "*",
    industries: "*",
    needsWeakEmailAuth: true,
  },
  {
    id: "oss-supply-chain",
    title: "Open-source supply-chain exposure",
    kind: "cyber",
    summary:
      "Public package manifests create a software-supply-chain surface. VERIQ does not claim a named package is malicious — only that dependencies were observed.",
    jurisdictions: "*",
    industries: "*",
    needsGithub: true,
  },
  {
    id: "tracker-privacy",
    title: "Advertising / analytics processors under a privacy statute",
    kind: "industry",
    summary:
      "Marketing pixels and analytics SDKs are data processors. Where a privacy statute is mapped, lawful basis and a DPA remain UNKNOWN until attested.",
    jurisdictions: "*",
    industries: "*",
    vendorIds: [
      "google-analytics",
      "meta-pixel",
      "hotjar",
      "mixpanel",
      "segment",
      "linkedin-insight",
    ],
  },
  {
    id: "aml-supervision",
    title: "AML / CFT supervisory pressure",
    kind: "regulatory",
    summary:
      "AML/CFT statutes for designated businesses remain in force. Customer due diligence and SAR ownership stay UNKNOWN until attested.",
    jurisdictions: ["KE", "UG", "TZ", "NG", "GB"],
    industries: ["fintech", "financial_services", "insurance"],
    regulationCodes: ["KE-AML"],
  },
  {
    id: "consumer-digital",
    title: "Digital consumer-protection scrutiny",
    kind: "market",
    summary:
      "Consumer-protection statutes apply to digital and financial products. Fair terms, refunds and channel trust are standing expectations — not a detected complaint.",
    jurisdictions: ["KE"],
    industries: ["fintech", "financial_services", "insurance", "retail", "saas"],
    regulationCodes: ["KE-CONSUMER"],
  },
  {
    id: "ke-aceca-standing",
    title: "Kenya ACECA / EACC standing regime",
    kind: "integrity",
    summary:
      "The Anti-Corruption and Economic Crimes Act remains in force. This is a standing public condition — not a claim that this company, a director or a counterparty is corrupt or under investigation.",
    jurisdictions: ["KE"],
    industries: "*",
    regulationCodes: ["KE-ACECA"],
  },
  {
    id: "ke-beneficial-ownership",
    title: "Kenya beneficial-ownership filing duty",
    kind: "regulatory",
    summary:
      "Beneficial-ownership filing is a standing Companies Act duty. Whether this company's persons with significant control are published is UNKNOWN. VERIQ will not invent a cap table.",
    jurisdictions: ["KE"],
    industries: "*",
    regulationCodes: ["KE-BO"],
  },
  {
    id: "ke-public-procurement",
    title: "Public procurement and asset-disposal duties",
    kind: "integrity",
    summary:
      "PPADA duties apply to public entities. Tender-file completeness stays UNKNOWN until attested. This is not a finding that a procurement was irregular.",
    jurisdictions: ["KE"],
    industries: ["public_sector"],
    regulationCodes: ["KE-PPADA"],
  },
  {
    id: "pep-sanctions-unknown",
    title: "PEP and sanctions screening is not operated here",
    kind: "integrity",
    summary:
      "VERIQ does not run a PEP, sanctions or leak database. Screening status is UNKNOWN for every company. A hit will never be invented.",
    jurisdictions: "*",
    industries: "*",
  },
  {
    id: "uk-operational-resilience",
    title: "UK operational-resilience expectations",
    kind: "regulatory",
    summary:
      "FCA operational-resilience and SYSC expectations are standing conditions for UK-regulated financial activity. Whether this company is a UK-regulated firm is UNKNOWN unless the jurisdiction is GB.",
    jurisdictions: ["GB"],
    industries: ["fintech", "financial_services", "insurance"],
    regulationCodes: ["GB-FCA"],
  },
];
