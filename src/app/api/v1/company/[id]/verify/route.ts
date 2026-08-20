import { apiJson, apiOptions, loadCompanyVerify } from "@/lib/api/serve";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { status, body } = await loadCompanyVerify(
    request.headers.get("authorization"),
    decodeURIComponent(id),
  );
  return apiJson(body, status);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { status, body } = await loadCompanyVerify(
    request.headers.get("authorization"),
    decodeURIComponent(id),
  );
  return apiJson(body, status);
}
