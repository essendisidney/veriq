import { apiJson, apiOptions, loadCompanyRisk } from "@/lib/api/serve";

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

  if (status !== 200) return apiJson({ error: body.error }, status);

  return apiJson({
    score: body.score ?? null,
    cybersecurity: body.cybersecurity ?? null,
    regulatory: body.regulatory ?? null,
    technology: body.technology ?? null,
    operational: body.operational ?? null,
    vendor: body.vendor ?? null,
    financial: body.financial ?? null,
    data: body.data ?? null,
    ai: body.ai ?? null,
    reputation: body.reputation ?? null,
    scanned_at: body.scanned_at ?? null,
    company: body.company,
    disclaimer: body.disclaimer,
  });
}
