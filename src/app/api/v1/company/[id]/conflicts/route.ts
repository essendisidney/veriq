import { apiJson, apiOptions, loadCompanyConflicts } from "@/lib/api/serve";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { status, body } = await loadCompanyConflicts(
    request.headers.get("authorization"),
    decodeURIComponent(id),
  );
  return apiJson(body, status);
}
