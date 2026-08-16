"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    <form
      onSubmit={onSubmit}
      className={cn("w-full", size === "hero" ? "max-w-2xl" : undefined)}
    >
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center",
          size === "hero" &&
            "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:gap-2",
        )}
      >
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Company name, website, or an email whose domain we can observe"
          className={cn(
            "flex-1",
            size === "hero" && "h-12 border-transparent bg-transparent text-base shadow-none",
          )}
          aria-label="Company to scan"
        />
        <Button type="submit" size={size === "hero" ? "lg" : "md"} className={size === "hero" ? "sm:px-7" : undefined}>
          Scan company
        </Button>
      </div>
    </form>
  );
}
