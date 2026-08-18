import { apiJson, apiOptions, loadCompanyRisk } from "@/lib/api/serve";
import { createAdminClient } from "@/lib/supabase/admin";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { status, body } = await loadCompanyRisk(
    request.headers.get("authorization"),
    decodeURIComponent(id),
  );
  if (status !== 200 || !body.company) return apiJson({ error: body.error }, status);

  const supabase = createAdminClient();
  if (!supabase) return apiJson({ error: "misconfigured" }, 503);

  const { data: pages } = await supabase
    .from("veriq_crawl_pages")
    .select("url, status, content_type, source_class, reason, observed_at, content_hash")
    .eq("organization_id", body.company.id)
    .order("observed_at", { ascending: false })
    .limit(40);

  const { data: scans } = await supabase
    .from("scans")
    .select("summary")
    .eq("organization_id", body.company.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);
  const summary = scans?.[0]?.summary as { digger?: unknown } | undefined;

  return apiJson({
    company: body.company,
    pages: pages ?? [],
    digger: summary?.digger ?? null,
    disclaimer: body.disclaimer,
    note: "Permitted same-origin crawl only. Login walls, CAPTCHAs, paywalls and government portals are not bypassed.",
  });
}
