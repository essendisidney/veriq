"use server";

import { scanWebsite } from "@/lib/scan/engine";
import { extractObservedClaims } from "@/lib/claims/assess";
import { detectVendors } from "@/lib/vendors/detect";
import { assessVendors } from "@/lib/vendors/assess";
import { resolvePublicQuery } from "@/lib/truth/query";
import { resolveCompanyIdentity, type CompanyIdentity } from "@/lib/truth/identity";
import { TRUST_CALL_HINTS, type TrustCall } from "@/lib/truth/call";

export type PublicFinding = {
  title: string;
  severity: "high" | "medium" | "low";
  why: string;
};

export type PublicSnapshot = {
  hostname: string;
  https: boolean;
  reachable: boolean;
  technologies: string[];
  privacyNotice: boolean;
  teamFootprint: number;
  websiteEmployees: number | null;
  websiteEmployeeText: string | null;
  licensedLanguage: boolean;
  trackerCount: number;
  call: TrustCall;
  callWhy: string;
  findings: PublicFinding[];
  additionalSignals: number;
  locked: string[];
  queriedAs: string;
  identity: {
    name: string;
    method: string;
    note: string;
    githubLogin: string | null;
  } | null;
  pagesRead: number;
};

export async function publicCompanySnapshot(query: string): Promise<
  { snapshot: PublicSnapshot } | { error: string }
> {
  const classified = resolvePublicQuery(query);
  if (classified.kind === "blocked") return { error: classified.error };

  let website = classified.kind === "website" ? classified.website : "";
  let identity: CompanyIdentity | null = null;
  if (classified.kind === "name") {
    const resolved = await resolveCompanyIdentity(classified.name);
    if ("error" in resolved) return { error: resolved.error };
    identity = resolved.identity;
    website = resolved.identity.website;
  }

  const scanned = await scanWebsite(website);
  if (!scanned) return { error: "Enter a public https website" };
  if (!scanned.reachable) {
    return { error: scanned.error ?? "That site was not reachable from VERIQ" };
  }

  const detected = detectVendors({
    html: `${scanned.html}\n${scanned.storyHtml}`,
    headers: scanned.responseHeaders,
    technologies: scanned.technologies,
  });
  const vendors = assessVendors({ detected, declared: [] });
  const observed = extractObservedClaims({
    html: scanned.storyText || scanned.html,
    teamFootprint: scanned.teamFootprint,
    teamPageUrl: scanned.teamPageUrl,
    vendors,
  });
  const trackers = vendors.vendors.filter(
    (item) => item.category === "analytics" || item.category === "ads",
  );

  const findings: PublicFinding[] = [];
  if (!scanned.https) {
    findings.push({
      title: "Site is not served over HTTPS",
      severity: "high",
      why: "Traffic can be intercepted. Do not treat this as a safe customer channel.",
    });
  }
  if (!scanned.privacyPolicyUrl && trackers.length > 0) {
    findings.push({
      title: "Trackers observed without a privacy notice",
      severity: "medium",
      why: "The public story about data use does not match the observed surface.",
    });
  }
  if (observed.websiteEmployeeText) {
    findings.push({
      title: "Public headcount claim",
      severity: "medium",
      why: `Website copy “${observed.websiteEmployeeText.trim()}” is a claim, not a payroll.`,
    });
  }
  if (observed.licensedLanguage) {
    findings.push({
      title: "Licence language on the public site",
      severity: "medium",
      why: "Marketing language is not a CBK, CMA or IRA licence. Upload the artefact to validate.",
    });
  }
  if (findings.length === 0) {
    findings.push({
      title: "Public site is reachable over HTTPS",
      severity: "low",
      why: "That is an observed digital identity, not a company extract.",
    });
  }

  const locked = [
    "Directors and shareholders (CR12)",
    "Beneficial ownership",
    "Licence standing",
    "Claim vs evidence validation",
    "Related entities",
    "Financial capacity",
    "Continuous monitoring",
    "Litigation / adverse media",
    "Supplier and customer relationships",
    "Partnerships",
    "Key-person standing",
  ];

  let call: TrustCall = "investigate";
  if (!scanned.https) call = "stop";
  else if (
    findings.some((item) => item.severity === "medium" || item.severity === "high")
  ) {
    call = "investigate";
  } else {
    call = "proceed";
  }

  return {
    snapshot: {
      hostname: scanned.hostname,
      https: scanned.https,
      reachable: scanned.reachable,
      technologies: scanned.technologies.slice(0, 8),
      privacyNotice: Boolean(scanned.privacyPolicyUrl),
      teamFootprint: observed.teamFootprint,
      websiteEmployees: observed.websiteEmployees,
      websiteEmployeeText: observed.websiteEmployeeText,
      licensedLanguage: observed.licensedLanguage,
      trackerCount: trackers.length,
      call,
      callWhy: TRUST_CALL_HINTS[call],
      findings: findings.slice(0, 3),
      additionalSignals: Math.max(0, locked.length - 3),
      locked,
      queriedAs: query.trim(),
      identity: identity
        ? {
            name: identity.name,
            method: identity.method,
            note: identity.note,
            githubLogin: identity.githubLogin,
          }
        : null,
      pagesRead: scanned.crawled.filter((row) => row.status === "fetched").length ||
        (scanned.reachable ? 1 : 0) + scanned.storyPages.length,
    },
  };
}
