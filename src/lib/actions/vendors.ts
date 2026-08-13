"use server";

import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import {
  VENDOR_CATALOG,
  type VendorCategory,
} from "@/lib/vendors/catalog";
import type { AssetCriticality } from "@/lib/database.types";

export async function declareVendor(input: {
  organizationId: string;
  name: string;
  category: VendorCategory;
  criticality: AssetCriticality;
  processesData: boolean;
  connectsToProduction: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = input.name.trim();
  if (!name) return { error: "Vendor name is required" };

  const catalog = VENDOR_CATALOG.find(
    (item) => item.name.toLowerCase() === name.toLowerCase() || item.id === slugify(name),
  );
  const vendorId = catalog?.id ?? slugify(name);
  if (!vendorId) return { error: "Could not derive a vendor id" };

  const { data: existing } = await supabase
    .from("assets")
    .select("id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("type", "vendor");

  const match = (existing ?? []).find((row) => {
    const meta = row.metadata as { vendorId?: string } | null;
    return meta?.vendorId === vendorId;
  });

  const metadata = {
    vendorId,
    category: catalog?.category ?? input.category,
    processesData: catalog?.processesData ?? input.processesData,
    connectsToProduction: catalog?.connectsToProduction ?? input.connectsToProduction,
    dataClasses: catalog?.dataClasses ?? [],
    origin: "declared",
    sources: [{ kind: "declared", reference: "manual" }],
  };

  if (match) {
    const { error } = await supabase
      .from("assets")
      .update({
        name: catalog?.name ?? name,
        criticality: input.criticality,
        metadata,
      })
      .eq("id", match.id);
    if (error) return { error: error.message };
    return { vendorId };
  }

  const { error } = await supabase.from("assets").insert({
    organization_id: input.organizationId,
    name: catalog?.name ?? name,
    type: "vendor",
    criticality: input.criticality,
    metadata,
  });
  if (error) return { error: error.message };
  return { vendorId };
}
