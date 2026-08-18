"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, INDUSTRIES, slugify } from "@/lib/utils";
import { packForIndustry } from "@/lib/packs/sector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runOrganizationScan } from "@/lib/actions/scan";
import { resolveCompanyIdentityAction } from "@/lib/actions/identity";
import {
  ORG_STORAGE_KEY,
  useWorkspaceOptional,
} from "@/components/workspace/workspace-provider";

export default function OnboardingPage() {
  const router = useRouter();
  const workspace = useWorkspaceOptional();
  const addingAnother = Boolean(workspace?.organizations.length);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("KE");
  const [industry, setIndustry] = useState("fintech");
  const [githubLogin, setGithubLogin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"idle" | "find" | "scan">("idle");
  const pack = packForIndustry(industry);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(website.trim() ? "scan" : "find");

    const supabase = createClient();
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    let websiteUrl = website.trim();
    let github = githubLogin.replace(/^@/, "") || null;

    if (!websiteUrl) {
      const resolved = await resolveCompanyIdentityAction(name);
      if ("error" in resolved) {
        setError(resolved.error);
        setLoading("idle");
        return;
      }
      websiteUrl = resolved.identity.website;
      github = github || resolved.identity.githubLogin;
    }

    const { data, error: rpcError } = await supabase.rpc("create_organization", {
      p_name: name.trim(),
      p_slug: slug,
      p_website: websiteUrl || null,
      p_country: country,
      p_industry: industry,
      p_github_login: github,
    });

    if (rpcError || !data) {
      setError(rpcError?.message ?? "Could not create company");
      setLoading("idle");
      return;
    }

    setLoading("scan");
    await runOrganizationScan(data);
    localStorage.setItem(ORG_STORAGE_KEY, data);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className={
        addingAnother
          ? "mx-auto max-w-lg"
          : "flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-16"
      }
    >
      <div className="w-full max-w-lg">
        <p className="eyebrow">{addingAnother ? "Another institution" : "The company model"}</p>
        <h1 className="mt-3 font-display text-4xl italic text-[var(--ink)]">
          {addingAnother
            ? "Add a company to VERIQ"
            : "Create the company you want to VERIQ"}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--muted)]">
          {addingAnother
            ? "Name the institution. VERIQ finds the public website and GitHub, then scans the story. Paste a URL if you already have it."
            : "Name the company. VERIQ finds the public site and reads the story — not a KYB dump. Website and GitHub are optional."}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7"
        >
          {error && (
            <div className="rounded-lg bg-[rgba(255,77,109,0.12)] px-3 py-2 text-sm text-[var(--critical)]">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="name">Company name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Payments Ltd"
              required
            />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Leave blank — VERIQ will resolve it from the name"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3.5 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3.5 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
              >
                {INDUSTRIES.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Audit pack: {pack.title}
                {pack.implemented
                  ? " — SME rules run on authorised documents."
                  : " — catalog only until a design partner fills the rules."}
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="github">GitHub organisation or username</Label>
            <Input
              id="github"
              value={githubLogin}
              onChange={(e) => setGithubLogin(e.target.value)}
              placeholder="Optional — public org or username"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Paste a handle if you have one. VERIQ does not guess GitHub from the company name.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading !== "idle"}>
            {loading === "find"
              ? "Finding the public site…"
              : loading === "scan"
                ? "Reading the public story…"
                : addingAnother
                  ? "Add company and scan"
                  : "Create company and scan"}
          </Button>
        </form>
      </div>
    </div>
  );
}
