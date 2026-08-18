import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { DiggerReport } from "./types";

export async function persistDigger(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  report: DiggerReport,
) {
  for (const page of report.pages) {
    await supabase.from("veriq_crawl_pages").upsert(
      {
        organization_id: organizationId,
        url: page.url.slice(0, 1800),
        status: page.status,
        content_type: page.contentType,
        content_hash: page.contentHash,
        excerpt: page.excerpt.slice(0, 4000),
        source_class: page.sourceClass,
        reason: page.reason.slice(0, 500),
        observed_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,url" },
    );
  }
}
