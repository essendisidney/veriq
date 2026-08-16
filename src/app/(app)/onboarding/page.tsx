"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, INDUSTRIES, slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runOrganizationScan } from "@/lib/actions/scan";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("KE");
  const [industry, setIndustry] = useState("fintech");
  const [githubLogin, setGithubLogin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error: rpcError } = await supabase.rpc("create_organization", {
      p_name: name,
      p_slug: slug,
      p_website: website || null,
      p_country: country,
      p_industry: industry,
      p_github_login: githubLogin.replace(/^@/, "") || null,
    });

    if (rpcError || !data) {
      setError(rpcError?.message ?? "Could not create company");
      setLoading(false);
      return;
    }

    await runOrganizationScan(data);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-16">
      <div className="w-full max-w-lg">
        <p className="eyebrow">The company model</p>
        <h1 className="mt-3 font-display text-4xl italic text-[var(--ink)]">
          Create the company you want to VERIQ
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--muted)]">
          Name, website, country, industry, GitHub. Then we scan for evidence — not a KYB dump.
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
              placeholder="https://acme.co.ke"
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
            </div>
          </div>
          <div>
            <Label htmlFor="github">GitHub organisation or username</Label>
            <Input
              id="github"
              value={githubLogin}
              onChange={(e) => setGithubLogin(e.target.value)}
              placeholder="acme-org"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Public repositories only for this MVP. Secret values are never stored.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating and scanning…" : "Create company and scan"}
          </Button>
        </form>
      </div>
    </div>
  );
}
