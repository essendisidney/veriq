import { apiJson, apiOptions, loadCompanyAcquisition } from "@/lib/api/serve";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { status, body } = await loadCompanyAcquisition(
    request.headers.get("authorization"),
    decodeURIComponent(id),
  );
  if (status !== 200) return apiJson(body, status);
  return apiJson(
    {
      company: body.company,
      sources: body.sources,
      disclaimer: body.disclaimer,
      note: body.note,
    },
    200,
  );
}
