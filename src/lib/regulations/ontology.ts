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

const GOVERNANCE_EVIDENCE: EvidenceNeed[] = [
  { key: "board_oversight", label: "Board risk oversight record", control: "corporate_governance", kind: "attested" },
];

const INSOLVENCY_EVIDENCE: EvidenceNeed[] = [
  { key: "books_of_account", label: "Books of account / accounting records", control: "financial_controls", kind: "attested" },
  { key: "statement_of_affairs", label: "Statement of affairs (assets, liabilities, creditors)", control: "corporate_governance", kind: "attested" },
  { key: "claims_register", label: "Creditor and employee claims register", control: "corporate_governance", kind: "attested" },
];

const ADVOCATES_EVIDENCE: EvidenceNeed[] = [
  { key: "https", label: "Confidential client channel (HTTPS)", control: "data_security", kind: "observable" },
  { key: "practising_certificate", label: "Practising certificate / LSK standing", control: "corporate_governance", kind: "attested" },
  { key: "client_account", label: "Client-account segregation", control: "financial_controls", kind: "attested" },
  { key: "client_cdd", label: "Client intake / CDD for designated work", control: "aml", kind: "attested" },
];

const INTEGRITY_EVIDENCE: EvidenceNeed[] = [
  { key: "conflict_register", label: "Conflict-of-interest register", control: "corporate_governance", kind: "attested" },
  { key: "gifts_hospitality", label: "Gifts and hospitality register", control: "corporate_governance", kind: "attested" },
  { key: "procurement_file", label: "Procurement / related-party file", control: "aml", kind: "attested" },
];

const BENEFICIAL_OWNERSHIP_EVIDENCE: EvidenceNeed[] = [
  { key: "beneficial_ownership_filing", label: "Beneficial-ownership filing", control: "corporate_governance", kind: "attested" },
  { key: "psc_register", label: "Persons-with-significant-control record", control: "corporate_governance", kind: "attested" },
];

const PROCUREMENT_EVIDENCE: EvidenceNeed[] = [
  { key: "tender_file", label: "Tender file / evaluation record", control: "corporate_governance", kind: "attested" },
  { key: "award_notice", label: "Award notice where required", control: "corporate_governance", kind: "attested" },
  { key: "beneficial_ownership_tender", label: "Beneficial ownership on the tender", control: "aml", kind: "attested" },
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
    evidence: GOVERNANCE_EVIDENCE,
    impact: "Director duties and filing failures become governance findings for investors and lenders.",
  },
  {
    code: "KE-IA",
    name: "Insolvency Act, 2015",
    jurisdiction: "KE",
    category: "insolvency",
    summary:
      "Kenya’s framework for administration, liquidation, receivership and related insolvency procedures, including books of account, statements of affairs and cooperation with an insolvency practitioner.",
    industries: ALL,
    controls: ["corporate_governance", "financial_controls", "business_continuity"],
    evidence: INSOLVENCY_EVIDENCE,
    impact:
      "Without books of account and a statement of affairs, an insolvency practitioner or counsel cannot take a first-week picture of the estate. VERIQ will not invent creditors, cash or a going-concern opinion.",
  },
  {
    code: "KE-ADV",
    name: "Advocates Act / Law Society of Kenya professional conduct",
    jurisdiction: "KE",
    category: "professional",
    summary:
      "Admission, practising certificate, client-account and professional-conduct expectations for advocates in Kenya. Mapped to professional-services firms — not a finding of professional misconduct.",
    industries: ["professional_services"],
    controls: ["corporate_governance", "financial_controls", "aml", "data_security"],
    evidence: ADVOCATES_EVIDENCE,
    impact:
      "A firm that cannot evidence practising standing, client-account segregation or intake CDD creates mandate, insurance and LSK risk. This is not a disciplinary finding.",
  },
  {
    code: "KE-ACECA",
    name: "Anti-Corruption and Economic Crimes Act",
    jurisdiction: "KE",
    category: "integrity",
    summary:
      "Kenya’s standing anti-corruption and economic-crimes framework, including conflict, gifts and abuse-of-office duties. Mapped as a public regime — not a finding that this company or any person is corrupt.",
    industries: ALL,
    controls: ["corporate_governance", "aml"],
    evidence: INTEGRITY_EVIDENCE,
    impact:
      "Institutions ask whether conflict, gifts and related-party files exist. Absence is UNKNOWN evidence, not an EACC allegation. VERIQ will not invent corruption.",
  },
  {
    code: "KE-BO",
    name: "Companies Act beneficial-ownership duties",
    jurisdiction: "KE",
    category: "governance",
    summary:
      "Beneficial-ownership filing and persons-with-significant-control duties under Kenya company law. Where the register is published it is a public fact; VERIQ does not scrape it.",
    industries: ALL,
    controls: ["corporate_governance"],
    evidence: BENEFICIAL_OWNERSHIP_EVIDENCE,
    impact:
      "Unattested beneficial ownership is a diligence gap. VERIQ will not invent shareholders, PEPs or a shell-company finding.",
  },
  {
    code: "KE-PPADA",
    name: "Public Procurement and Asset Disposal Act",
    jurisdiction: "KE",
    category: "integrity",
    summary:
      "Public procurement, evaluation and award duties for public entities in Kenya. Mapped to public-sector organisations — not a finding that a tender was irregular.",
    industries: ["public_sector"],
    controls: ["corporate_governance", "aml", "financial_controls"],
    evidence: PROCUREMENT_EVIDENCE,
    impact:
      "A public entity that cannot evidence the tender file creates audit and integrity risk. This is not a PPRA or EACC finding.",
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
    code: "KE-CMCA",
    name: "Computer Misuse and Cybercrimes Act, 2018",
    jurisdiction: "KE",
    category: "cybersecurity",
    summary:
      "Kenya’s criminal and investigative framework for unauthorised access, data interference, cyber harassment and related offences.",
    industries: ALL,
    controls: ["cybersecurity", "incident_management", "access_management"],
    evidence: CYBER_EVIDENCE,
    impact: "A credential leak or exposed endpoint can become a criminal-incident and reporting event, not only an IT finding.",
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
    code: "UG-AML",
    name: "Anti-Money Laundering Act (Uganda)",
    jurisdiction: "UG",
    category: "aml",
    summary:
      "Uganda’s AML/CFT obligations for financial institutions and accountable persons, including CDD and suspicious transaction reporting.",
    industries: ["financial_services", "fintech", "insurance"],
    controls: ["aml", "financial_controls"],
    evidence: AML_EVIDENCE,
    impact: "Banking relationships and licence conditions depend on an evidenced AML programme.",
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
    code: "TZ-CYBER",
    name: "Cybercrimes Act (Tanzania)",
    jurisdiction: "TZ",
    category: "cybersecurity",
    summary:
      "Tanzania’s cybercrime statute covering unauthorised access, data interference and related computer offences.",
    industries: ALL,
    controls: ["cybersecurity", "incident_management", "access_management"],
    evidence: CYBER_EVIDENCE,
    impact: "Public credential exposure and weak access control become legal as well as operational findings.",
  },
  {
    code: "RW-DPA",
    name: "Law Nº 058/2021 relating to the protection of personal data",
    jurisdiction: "RW",
    category: "privacy",
    summary:
      "Rwanda’s personal data protection law — lawful processing, security, retention and data subject rights under NCSA oversight.",
    industries: ALL,
    controls: ["privacy", "data_security", "retention", "processing", "data_subject_rights"],
    evidence: PRIVACY_EVIDENCE,
    impact: "NCSA expectations on safeguards and accountability for Rwandan personal data.",
  },
  {
    code: "RW-CYBER",
    name: "Law on cyber security / critical information infrastructure (Rwanda)",
    jurisdiction: "RW",
    category: "cybersecurity",
    summary:
      "Rwanda’s cybersecurity and critical-information-infrastructure expectations, including incident handling and access control.",
    industries: ["financial_services", "fintech", "telecommunications", "public_sector", "energy"],
    controls: ["cybersecurity", "incident_management", "access_management"],
    evidence: CYBER_EVIDENCE,
    impact: "Weak internet posture and unowned incidents become supervisory findings.",
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
