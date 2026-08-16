import { Suspense } from "react";
import CheckClient from "./check-client";

export default function CheckPage() {
  return (
    <Suspense fallback={<p className="p-10 text-sm text-[var(--muted)]">Loading…</p>}>
      <CheckClient />
    </Suspense>
  );
}
