"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CompanySearch({
  initial = "",
  size = "default",
}: {
  initial?: string;
  size?: "hero" | "default";
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/check?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} className={size === "hero" ? "w-full max-w-2xl" : "w-full"}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Website, or an email whose domain we can observe"
          className={size === "hero" ? "h-12 flex-1 text-base" : "flex-1"}
          aria-label="Company to scan"
        />
        <Button type="submit" className={size === "hero" ? "h-12 px-6" : undefined}>
          Scan company
        </Button>
      </div>
    </form>
  );
}
