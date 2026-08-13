import { apiJson, apiOptions } from "@/lib/api/serve";

export function OPTIONS() {
  return apiOptions();
}

export function GET() {
  return apiJson({ ok: true, service: "veriq-api", version: "v1" });
}
