import { assertPublicScanUrl } from "@/lib/webhooks/ssrf";

const UA = "VERIQ-Scan/0.1 (corporate-risk-intelligence)";
const MAX_REDIRECTS = 4;

type SafeFetchInit = Omit<RequestInit, "redirect"> & {
  timeoutMs?: number;
  maxBytes?: number;
};

export async function safeFetch(
  rawUrl: string,
  init: SafeFetchInit = {},
): Promise<{ response: Response; url: string } | { error: string }> {
  const { timeoutMs = 12000, maxBytes, ...rest } = init;
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const checked = await assertPublicScanUrl(current);
    if ("error" in checked) return checked;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(checked.url.toString(), {
        ...rest,
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": UA, ...(rest.headers ?? {}) },
      });
    } catch (error) {
      clearTimeout(timeout);
      return {
        error:
          error instanceof Error ? error.message : "Target could not be reached",
      };
    }
    clearTimeout(timeout);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { error: "Redirect was missing a location" };
      current = new URL(location, checked.url).toString();
      continue;
    }

    if (maxBytes != null) {
      const length = Number(response.headers.get("content-length") ?? "0");
      if (length > maxBytes) {
        return { error: "Response is larger than the scan limit" };
      }
    }

    return { response, url: checked.url.toString() };
  }

  return { error: "Too many redirects" };
}

export async function safeFetchOk(rawUrl: string, timeoutMs = 6000) {
  const result = await safeFetch(rawUrl, { method: "GET", timeoutMs });
  if ("error" in result) return false;
  return result.response.ok;
}
