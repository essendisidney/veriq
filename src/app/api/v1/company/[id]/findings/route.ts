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
    company: body.company,
    findings: body.findings ?? [],
    disclaimer: body.disclaimer,
  });
}
