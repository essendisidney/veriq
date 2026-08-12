"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runOrganizationScan } from "@/lib/actions/scan";
import { Button } from "@/components/ui/button";

export function ScanButton({
  organizationId,
  label = "Start scan",
}: {
  organizationId: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setLoading(true);
    setError(null);
    const result = await runOrganizationScan(organizationId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleScan} disabled={loading}>
        {loading ? "Scanning…" : label}
      </Button>
      {error && <p className="text-xs text-[var(--critical)]">{error}</p>}
    </div>
  );
}
