"use server";

import { resolveCompanyIdentity } from "@/lib/truth/identity";

export async function resolveCompanyIdentityAction(name: string) {
  return resolveCompanyIdentity(name);
}
