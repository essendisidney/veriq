export type MembershipRole =
  | "org_admin"
  | "risk_manager"
  | "executive"
  | "viewer";

export type Severity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

export type RiskStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "accepted";

export type Certainty = "confirmed" | "potential" | "informational";
export type ValidationStatus =
  | "pending"
  | "confirmed"
  | "disproved"
  | "partially_confirmed"
  | "unresolved"
  | "insufficient_evidence";
export type IntelligenceStage = "signal" | "finding" | "validated";

export type ScanType = "initial" | "daily" | "weekly" | "event" | "on_demand";
export type ScanStatus = "queued" | "running" | "completed" | "failed";
export type TrustStatus = "observed" | "inferred" | "predicted" | "unknown";
export type ActionStatus = "open" | "in_progress" | "done" | "cancelled";
export type ActionPriority = "critical" | "high" | "medium" | "low";
export type AssetCriticality = "critical" | "high" | "medium" | "low";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Organization = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  country: string;
  industry: string;
  github_login: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Membership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: MembershipRole;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

export type Domain = {
  id: string;
  organization_id: string;
  hostname: string;
  url: string | null;
  https: boolean | null;
  status_code: number | null;
  security_headers: Json;
  technologies: string[];
  last_seen_at: string | null;
  created_at: string;
};

export type Repository = {
  id: string;
  organization_id: string;
  provider: string;
  external_id: string | null;
  name: string;
  full_name: string;
  url: string;
  visibility: string;
  default_branch: string | null;
  language: string | null;
  description: string | null;
  stars: number;
  has_license: boolean | null;
  last_scanned_at: string | null;
  metadata: Json;
  created_at: string;
};

export type Scan = {
  id: string;
  organization_id: string;
  type: ScanType;
  status: ScanStatus;
  started_at: string | null;
  completed_at: string | null;
  summary: Json;
  error: string | null;
  created_at: string;
};

export type Risk = {
  id: string;
  organization_id: string;
  scan_id: string | null;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  likelihood: number;
  impact: number;
  confidence: number;
  status: RiskStatus;
  certainty: Certainty;
  validation_status: ValidationStatus;
  intelligence_stage: IntelligenceStage;
  validation_method: string | null;
  required_document: string | null;
  validated_at: string | null;
  validated_by: string | null;
  why_it_matters: string | null;
  recommendation: string | null;
  owner_role: string | null;
  fingerprint: string;
  created_at: string;
  updated_at: string;
};

export type EvidenceDocument = {
  id: string;
  organization_id: string;
  risk_id: string | null;
  kind: string;
  filename: string;
  mime: string | null;
  byte_size: number;
  sha256: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

export type ValidationEvent = {
  id: string;
  organization_id: string;
  risk_id: string;
  document_id: string | null;
  from_status: ValidationStatus | null;
  to_status: ValidationStatus;
  note: string | null;
  actor: string | null;
  created_at: string;
};

export type Evidence = {
  id: string;
  organization_id: string;
  risk_id: string;
  source_type: string;
  source_reference: string | null;
  content: string;
  confidence: number;
  trust_status: TrustStatus;
  observed_at: string;
};

export type Action = {
  id: string;
  organization_id: string;
  risk_id: string | null;
  title: string;
  owner_role: string | null;
  priority: ActionPriority;
  deadline: string | null;
  status: ActionStatus;
  created_at: string;
  updated_at: string;
};

export type Score = {
  id: string;
  organization_id: string;
  scan_id: string | null;
  overall: number;
  cybersecurity: number;
  regulatory: number;
  technology: number;
  operational: number;
  vendor: number;
  financial: number;
  data: number;
  ai: number;
  reputation: number;
  created_at: string;
};

export type Regulation = {
  id: string;
  code: string;
  name: string;
  jurisdiction: string;
  category: string;
  summary: string;
  industries: string[];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      organizations: {
        Row: Organization;
        Insert: Partial<Organization> & { name: string; slug: string };
        Update: Partial<Organization>;
        Relationships: [];
      };
      memberships: {
        Row: Membership;
        Insert: Partial<Membership> & {
          organization_id: string;
          user_id: string;
        };
        Update: Partial<Membership>;
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          type: string;
          criticality: AssetCriticality;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          organization_id: string;
          name: string;
          type: string;
          criticality?: AssetCriticality;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["assets"]["Insert"]>;
        Relationships: [];
      };
      domains: {
        Row: Domain;
        Insert: Partial<Domain> & { organization_id: string; hostname: string };
        Update: Partial<Domain>;
        Relationships: [];
      };
      repositories: {
        Row: Repository;
        Insert: Partial<Repository> & {
          organization_id: string;
          name: string;
          full_name: string;
          url: string;
        };
        Update: Partial<Repository>;
        Relationships: [];
      };
      scans: {
        Row: Scan;
        Insert: Partial<Scan> & { organization_id: string };
        Update: Partial<Scan>;
        Relationships: [];
      };
      risks: {
        Row: Risk;
        Insert: Partial<Risk> & {
          organization_id: string;
          title: string;
          category: string;
          severity: Severity;
          fingerprint: string;
        };
        Update: Partial<Risk>;
        Relationships: [];
      };
      evidence: {
        Row: Evidence;
        Insert: Partial<Evidence> & {
          organization_id: string;
          risk_id: string;
          source_type: string;
          content: string;
        };
        Update: Partial<Evidence>;
        Relationships: [];
      };
      evidence_documents: {
        Row: EvidenceDocument;
        Insert: Partial<EvidenceDocument> & {
          organization_id: string;
          filename: string;
          sha256: string;
          storage_path: string;
        };
        Update: Partial<EvidenceDocument>;
        Relationships: [];
      };
      validation_events: {
        Row: ValidationEvent;
        Insert: Partial<ValidationEvent> & {
          organization_id: string;
          risk_id: string;
          to_status: ValidationStatus;
        };
        Update: Partial<ValidationEvent>;
        Relationships: [];
      };
      actions: {
        Row: Action;
        Insert: Partial<Action> & { organization_id: string; title: string };
        Update: Partial<Action>;
        Relationships: [];
      };
      scores: {
        Row: Score;
        Insert: Omit<Score, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Score>;
        Relationships: [];
      };
      regulations: {
        Row: Regulation;
        Insert: Partial<Regulation> & {
          code: string;
          name: string;
          jurisdiction: string;
          category: string;
          summary: string;
        };
        Update: Partial<Regulation>;
        Relationships: [];
      };
      organization_regulations: {
        Row: {
          id: string;
          organization_id: string;
          regulation_id: string;
          applicability: string;
          notes: string | null;
        };
        Insert: {
          organization_id: string;
          regulation_id: string;
          applicability?: string;
          notes?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["organization_regulations"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: {
        Args: {
          p_name: string;
          p_slug: string;
          p_website?: string | null;
          p_country?: string;
          p_industry?: string;
          p_github_login?: string | null;
        };
        Returns: string;
      };
      is_org_member: {
        Args: { org_id: string };
        Returns: boolean;
      };
      veriq_api_risk: {
        Args: { p_token_hash: string; p_company: string };
        Returns: Json;
      };
      veriq_api_snapshot: {
        Args: { p_token_hash: string; p_company: string };
        Returns: Json;
      };
    };
    Enums: {
      membership_role: MembershipRole;
      severity: Severity;
      risk_status: RiskStatus;
      scan_type: ScanType;
      scan_status: ScanStatus;
      trust_status: TrustStatus;
      action_status: ActionStatus;
      action_priority: ActionPriority;
      asset_criticality: AssetCriticality;
      validation_status: ValidationStatus;
      intelligence_stage: IntelligenceStage;
    };
    CompositeTypes: Record<string, never>;
  };
};
