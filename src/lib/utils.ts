import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ActionPriority, Severity, TrustStatus } from "./database.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Info",
};

export const TRUST_LABELS: Record<TrustStatus, string> = {
  observed: "Observed",
  inferred: "Inferred",
  predicted: "Predicted",
  unknown: "Unknown",
};

export const PRIORITY_LABELS: Record<ActionPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const INDUSTRIES = [
  { value: "fintech", label: "Fintech" },
  { value: "financial_services", label: "Financial services" },
  { value: "insurance", label: "Insurance" },
  { value: "saas", label: "SaaS" },
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "retail", label: "Retail" },
  { value: "logistics", label: "Logistics" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "energy", label: "Energy" },
  { value: "agriculture", label: "Agriculture" },
  { value: "public_sector", label: "Public sector" },
  { value: "professional_services", label: "Professional services" },
  { value: "other", label: "Other" },
] as const;

export const COUNTRIES = [
  { value: "KE", label: "Kenya" },
  { value: "UG", label: "Uganda" },
  { value: "TZ", label: "Tanzania" },
  { value: "RW", label: "Rwanda" },
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "ZA", label: "South Africa" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "OTHER", label: "Other" },
] as const;

export const SCORE_DIMENSIONS = [
  { key: "cybersecurity", label: "Cybersecurity" },
  { key: "regulatory", label: "Regulatory" },
  { key: "technology", label: "Technology" },
  { key: "operational", label: "Operational" },
  { key: "vendor", label: "Vendor" },
  { key: "financial", label: "Financial" },
  { key: "data", label: "Data" },
  { key: "ai", label: "AI" },
  { key: "reputation", label: "Reputation" },
] as const;

export function industryLabel(value: string) {
  return INDUSTRIES.find((i) => i.value === value)?.label ?? value;
}

export function countryLabel(value: string) {
  return COUNTRIES.find((c) => c.value === value)?.label ?? value;
}

export function scoreTone(score: number) {
  if (score >= 80) return "good";
  if (score >= 60) return "ok";
  if (score >= 40) return "warn";
  return "bad";
}
