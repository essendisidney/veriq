const REFUSED_HOSTS = [
  "ecitizen.go.ke",
  "accounts.ecitizen.go.ke",
  "brs.go.ke",
  "itax.kra.go.ke",
  "odpc.go.ke",
  "linkedin.com",
  "www.linkedin.com",
  "facebook.com",
  "www.facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
];

const LOGIN_PATH =
  /\/(login|signin|sign-in|signup|register|account|wp-admin|checkout|cart|paywall|captcha)(\/|$)/i;

const LOGIN_BODY =
  /recaptcha|hcaptcha|cf-turnstile|please (log|sign) in|password.*username|this content is for subscribers|paywall/i;

export function hostRefused(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return REFUSED_HOSTS.some(
    (blocked) => host === blocked.replace(/^www\./, "") || host.endsWith(`.${blocked.replace(/^www\./, "")}`),
  );
}

export function urlRefused(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return "Credentials in the URL are refused.";
    if (hostRefused(url.hostname)) {
      return "That host is a login, registry, or social wall. VERIQ does not bypass it.";
    }
    if (LOGIN_PATH.test(url.pathname)) return "Login, checkout and admin paths are not crawled.";
    return null;
  } catch {
    return "URL is not valid.";
  }
}

export function bodyLooksGated(html: string, status: number) {
  if (status === 401 || status === 402 || status === 403) return "login_wall" as const;
  if (LOGIN_BODY.test(html.slice(0, 8000))) {
    if (/recaptcha|hcaptcha|cf-turnstile|captcha/i.test(html)) return "captcha" as const;
    if (/paywall|subscribers/i.test(html)) return "paywall" as const;
    return "login_wall" as const;
  }
  return null;
}

export function sameRegistrable(a: string, b: string) {
  const left = a.toLowerCase().replace(/^www\./, "");
  const right = b.toLowerCase().replace(/^www\./, "");
  return left === right;
}
