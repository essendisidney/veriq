"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { packsForIndustry } from "@/lib/truth/packs";

const reports = [
  {
    href: "/reports/board",
    title: "Board risk report",
    description:
      "Score, trend, critical findings, regulatory gaps, vendor concentration, board questions and management actions.",
  },
  {
    href: "/reports/executive",
    title: "Executive risk report",
    description: "Leadership snapshot of the VERIQ Score, open findings and unknowns.",
  },
  {
    href: "/reports/diligence",
    title: "Investor due diligence",
    description:
      "Company Health Score across technology, cyber, regulatory, vendors, operations, AI and exposure. Not a valuation. Email a read-only share link.",
  },
  {
    href: "/reports/credit",
    title: "Bank / credit intelligence",
    description:
      "Business risk profile for lenders. Not a credit rating. Amounts UNKNOWN. Email a read-only share link.",
  },
  {
    href: "/reports/restructuring",
    title: "Restructuring / insolvency intelligence",
    description:
      "Operating continuity for counsel and insolvency practitioners. Not a legal opinion, not a statement of affairs. Email a read-only share link.",
  },
  {
    href: "/reports/cyber",
    title: "Cybersecurity report",
    description: "External posture, TLS, email authentication and cyber findings. Not a pentest.",
  },
  {
    href: "/reports/regulatory",
    title: "Regulatory report",
    description: "Mapped statutes, observable coverage and unknown artefacts. Not a legal opinion.",
  },
  {
    href: "/reports/vendor",
    title: "Vendor risk report",
    description: "Observed processors, concentration and substitution gaps. DPAs stay UNKNOWN.",
  },
  {
    href: "/reports/technology",
    title: "Technology risk report",
    description: "Website, GitHub, repositories and packages from the public snapshot.",
  },
  {
    href: "/reports/ai",
    title: "AI governance report",
    description: "Mapped systems and attested oversight. Absence of Copilot or ChatGPT is not assumed.",
  },
  {
    href: "/reports/resilience",
    title: "Business resilience report",
    description: "Scenarios, payment concentration and key-person bands. Impact amounts UNKNOWN.",
  },
  {
    href: "/reports/integrity",
    title: "Integrity / public-records report",
    description:
      "Observed notices versus trackers, connected GitHub, and Kenya registers that stay UNKNOWN until they are actually public. Not an EACC finding.",
  },
  {
    href: "/reports/procurement",
    title: "Procurement risk report",
    description:
      "Claim consistency, related-party unknowns and PPADA mapping before you award. Not a bid evaluation or PPRA finding.",
  },
  {
    href: "/world",
    title: "External world watch",
    description:
      "Does this public condition matter to this company? Standing statutes and vendor classes — not invented headlines.",
  },
  {
    href: "/developers",
    title: "Institutional JSON",
    description: "Banks, insurers, investors, counsel and insolvency practitioners can query the same snapshot through the VERIQ API.",
  },
];

export default function ReportsPage() {
  const { currentOrg } = useWorkspace();
  const packs = packsForIndustry(currentOrg?.industry ?? "other");

  return (
    <div>
      <PageHeader
        title="Reports"
        description="The same finding does not mean the same thing for a bank, a hospital and a contractor. Packs are industry-aware views of evidence — not more AI."
      />
      <section className="mb-8">
        <h2 className="font-display text-2xl">Risk packs for this company</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {packs.map((pack) => (
            <Link
              key={pack.id}
              href={pack.href}
              className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-dim)] p-5 hover:opacity-90"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                {pack.title}
              </p>
              <p className="mt-2 text-sm text-[var(--ink)]">{pack.question}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">{pack.domains.join(" · ")}</p>
            </Link>
          ))}
        </div>
      </section>
      <div className="grid gap-4">
        {reports.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)]"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="font-display text-2xl">{item.title}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
