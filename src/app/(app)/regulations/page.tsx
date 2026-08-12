"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Regulation } from "@/lib/database.types";

type MappedReg = Regulation & { applicability: string };

export default function RegulationsPage() {
  const { currentOrg } = useWorkspace();
  const [regs, setRegs] = useState<MappedReg[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("organization_regulations")
        .select("applicability, regulations(*)")
        .eq("organization_id", currentOrg!.id);
      const mapped =
        data
          ?.map((row) => {
            const reg = row.regulations as unknown as
              | Regulation
              | Regulation[]
              | null;
            const record = Array.isArray(reg) ? reg[0] : reg;
            if (!record) return null;
            return { ...record, applicability: row.applicability };
          })
          .filter((item): item is MappedReg => Boolean(item)) ?? [];
      setRegs(mapped);
    }
    void load();
  }, [currentOrg]);

  return (
    <div>
      <PageHeader
        title="Regulations"
        description="Jurisdiction mapping from country and industry. This is intelligence, not a legal opinion."
      />
      {regs.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No regulations mapped"
          description="Run a scan after setting country and industry."
        />
      ) : (
        <div className="grid gap-4">
          {regs.map((reg) => (
            <article
              key={reg.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{reg.name}</h2>
                <Badge>{reg.code}</Badge>
                <Badge variant="muted">{reg.jurisdiction}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {reg.summary}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
