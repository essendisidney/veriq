export const CONTROLS = [
  { id: "privacy", name: "Privacy" },
  { id: "data_security", name: "Data security" },
  { id: "retention", name: "Retention" },
  { id: "processing", name: "Processing" },
  { id: "data_subject_rights", name: "Data subject rights" },
  { id: "access_management", name: "Access management" },
  { id: "incident_management", name: "Incident management" },
  { id: "vendor_management", name: "Vendor management" },
  { id: "business_continuity", name: "Business continuity" },
  { id: "financial_controls", name: "Financial controls" },
  { id: "aml", name: "AML / CFT" },
  { id: "cybersecurity", name: "Cybersecurity" },
  { id: "corporate_governance", name: "Corporate governance" },
  { id: "ai_governance", name: "AI governance" },
  { id: "consumer", name: "Consumer protection" },
] as const;

export type ControlId = (typeof CONTROLS)[number]["id"];

export type EvidenceNeed = {
  key: string;
  label: string;
  control: ControlId;
  kind: "observable" | "attested";
};

export type RegulationDef = {
  code: string;
  name: string;
  jurisdiction: string;
  category: string;
  summary: string;
  industries: string[] | "*";
  controls: ControlId[];
  evidence: EvidenceNeed[];
  impact: string;
};

const PRIVACY_EVIDENCE: EvidenceNeed[] = [
  { key: "https", label: "Transport encryption (HTTPS)", control: "data_security", kind: "observable" },
  { key: "tls_valid", label: "Valid TLS certificate", control: "data_security", kind: "observable" },
  { key: "security_headers", label: "Browser security headers", control: "data_security", kind: "observable" },
  { key: "no_public_secrets", label: "No public credential files", control: "access_management", kind: "observable" },
  { key: "security_txt", label: "security.txt contact", control: "incident_management", kind: "observable" },
  { key: "data_inventory", label: "Personal data inventory", control: "processing", kind: "attested" },
  { key: "lawful_basis", label: "Lawful basis record", control: "privacy", kind: "attested" },
  { key: "retention_policy", label: "Retention schedule", control: "retention", kind: "attested" },
  { key: "dsar_process", label: "Data subject request process", control: "data_subject_rights", kind: "attested" },
];

const CYBER_EVIDENCE: EvidenceNeed[] = [
  { key: "https", label: "HTTPS on primary domain", control: "cybersecurity", kind: "observable" },
  { key: "hsts", label: "HSTS", control: "cybersecurity", kind: "observable" },
  { key: "no_public_secrets", label: "No public secrets in repositories", control: "access_management", kind: "observable" },
  { key: "incident_playbook", label: "Incident response playbook", control: "incident_management", kind: "attested" },
  { key: "vendor_register", label: "Critical vendor register", control: "vendor_management", kind: "attested" },
];

const AML_EVIDENCE: EvidenceNeed[] = [
  { key: "aml_programme", label: "AML/CFT programme ownership", control: "aml", kind: "attested" },
  { key: "cdd_process", label: "Customer due diligence process", control: "financial_controls", kind: "attested" },
  { key: "no_public_secrets", label: "Production credentials not public", control: "access_management", kind: "observable" },
];

const ALL = "*";

export const REGULATION_CATALOG: RegulationDef[] = [
  {
    code: "KE-DPA",
    name: "Kenya Data Protection Act, 2019",
    jurisdiction: "KE",
    category: "privacy",
    summary:
      "Governs collection, processing, storage and transfer of personal data in Kenya, including data subject rights and security safeguards.",
    industries: ALL,
    controls: ["privacy", "data_security", "retention", "processing", "data_subject_rights"],
    evidence: PRIVACY_EVIDENCE,
    impact: "ODPC enforcement, customer trust, and restrictions on processing if safeguards cannot be evidenced.",
  },
  {
    code: "KE-AML",
    name: "Proceeds of Crime and Anti-Money Laundering Act",
    jurisdiction: "KE",
    category: "aml",
    summary:
      "Requires financial institutions and designated businesses to implement AML/CFT controls, CDD and suspicious activity reporting.",
    industries: ["financial_services", "fintech", "insurance"],
    controls: ["aml", "financial_controls"],
    evidence: AML_EVIDENCE,
    impact: "Licensing, banking relationships and possible criminal exposure if the programme cannot be shown.",
  },
  {
    code: "KE-CBK-CYBER",
    name: "CBK Guidance on Cybersecurity",
    jurisdiction: "KE",
    category: "cybersecurity",
    summary:
      "Central Bank of Kenya guidance on cybersecurity governance, incident response and third-party risk for supervised institutions.",
    industries: ["financial_services", "fintech"],
    controls: ["cybersecurity", "incident_management", "vendor_management", "access_management"],
    evidence: CYBER_EVIDENCE,
    impact: "Supervisory findings can constrain growth, partnerships and licence conditions.",
  },
  {
    code: "KE-NPS",
    name: "National Payment System Act",
    jurisdiction: "KE",
    category: "financial",
    summary: "Regulates payment service providers, electronic money and payment system operators in Kenya.",
    industries: ["financial_services", "fintech"],
    controls: ["financial_controls", "cybersecurity"],
    evidence: [
      { key: "https", label: "Secure customer channels", control: "cybersecurity", kind: "observable" },
      { key: "licence_perimeter", label: "Payment licence perimeter", control: "financial_controls", kind: "attested" },
    ],
    impact: "Operating a payment service outside the authorised perimeter is a material regulatory risk.",
  },
  {
    code: "KE-CA",
    name: "Companies Act, 2015",
    jurisdiction: "KE",
    category: "governance",
    summary: "Corporate governance, director duties, reporting and company administration requirements in Kenya.",
    industries: ALL,
    controls: ["corporate_governance"],
    evidence: [
      { key: "board_oversight", label: "Board risk oversight record", control: "corporate_governance", kind: "attested" },
    ],
    impact: "Director duties and filing failures become governance findings for investors and lenders.",
  },
  {
    code: "KE-CONSUMER",
    name: "Consumer Protection Act",
    jurisdiction: "KE",
    category: "consumer",
    summary: "Protects consumers against unfair practices, including in digital and financial products.",
    industries: ["financial_services", "fintech", "insurance", "retail", "saas"],
    controls: ["consumer"],
    evidence: [
      { key: "https", label: "Trustworthy customer channel", control: "consumer", kind: "observable" },
      { key: "fair_terms", label: "Fair terms and disclosure review", control: "consumer", kind: "attested" },
    ],
    impact: "Unfair digital practices create complaints, refunds and reputational damage.",
  },
  {
    code: "UG-DPA",
    name: "Uganda Data Protection and Privacy Act, 2019",
    jurisdiction: "UG",
    category: "privacy",
    summary: "Uganda’s framework for personal data processing, security and data subject rights.",
    industries: ALL,
    controls: ["privacy", "data_security", "processing", "data_subject_rights"],
    evidence: PRIVACY_EVIDENCE,
    impact: "Personal Data Protection Office expectations on lawful processing and security.",
  },
  {
    code: "TZ-PDPA",
    name: "Tanzania Personal Data Protection Act, 2022",
    jurisdiction: "TZ",
    category: "privacy",
    summary: "Tanzania’s personal data protection statute covering processing, security and cross-border transfer.",
    industries: ALL,
    controls: ["privacy", "data_security", "processing"],
    evidence: PRIVACY_EVIDENCE,
    impact: "Registration and safeguard duties for controllers and processors.",
  },
  {
    code: "NG-NDPA",
    name: "Nigeria Data Protection Act, 2023",
    jurisdiction: "NG",
    category: "privacy",
    summary: "Nigeria’s NDPA — privacy, security, retention and data subject rights overseen by the NDPC.",
    industries: ALL,
    controls: ["privacy", "data_security", "retention", "processing", "data_subject_rights"],
    evidence: PRIVACY_EVIDENCE,
    impact: "NDPC enforcement and restrictions on processing without adequate safeguards.",
  },
  {
    code: "ZA-POPIA",
    name: "Protection of Personal Information Act",
    jurisdiction: "ZA",
    category: "privacy",
    summary: "South Africa’s POPIA conditions for lawful processing and information security.",
    industries: ALL,
    controls: ["privacy", "data_security", "processing", "data_subject_rights"],
    evidence: PRIVACY_EVIDENCE,
    impact: "Information Regulator action and contractual pressure from South African counterparties.",
  },
  {
    code: "GB-UKGDPR",
    name: "UK GDPR / Data Protection Act 2018",
    jurisdiction: "GB",
    category: "privacy",
    summary: "UK data protection regime for personal data, security and data subject rights.",
    industries: ALL,
    controls: ["privacy", "data_security", "retention", "processing", "data_subject_rights"],
    evidence: PRIVACY_EVIDENCE,
    impact: "ICO enforcement and UK customer/partner due diligence failure.",
  },
  {
    code: "GB-FCA",
    name: "FCA operational resilience / SYSC expectations",
    jurisdiction: "GB",
    category: "cybersecurity",
    summary: "UK financial conduct expectations on operational resilience, third parties and cyber governance.",
    industries: ["financial_services", "fintech", "insurance"],
    controls: ["cybersecurity", "business_continuity", "vendor_management"],
    evidence: CYBER_EVIDENCE,
    impact: "Supervisory intervention and constraints on regulated activity.",
  },
];

export function controlName(id: ControlId) {
  return CONTROLS.find((item) => item.id === id)?.name ?? id;
}

export function regulationsFor(country: string, industry: string) {
  return REGULATION_CATALOG.filter((reg) => {
    if (reg.jurisdiction !== country) return false;
    return reg.industries === ALL || reg.industries.includes(industry);
  });
}
