"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

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
      "Company Health Score across technology, cyber, regulatory, vendors, operations, AI and exposure. Not a valuation.",
  },
  {
    href: "/reports/credit",
    title: "Bank / credit intelligence",
    description:
      "Business risk profile for lenders. Not a credit rating. Amounts UNKNOWN.",
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
    href: "/world",
    title: "External world watch",
    description:
      "Does this public condition matter to this company? Standing statutes and vendor classes — not invented headlines.",
  },
  {
    href: "/developers",
    title: "Institutional JSON",
    description: "Banks, insurers and investors can query the same snapshot through the VERIQ API.",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Board, executive, investor, lender and domain packs from the latest scan. Print to PDF or export CSV / JSON."
      />
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
