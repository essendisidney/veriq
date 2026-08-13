import { apiJson, apiOptions, loadInstitutionalPack } from "@/lib/api/serve";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { status, body } = await loadInstitutionalPack(
    request.headers.get("authorization"),
    decodeURIComponent(id),
    "diligence",
  );
  return apiJson(body, status);
}
