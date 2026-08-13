"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES, INDUSTRIES } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { currentOrg, user } = useWorkspace();
  const [website, setWebsite] = useState(currentOrg?.website ?? "");
  const [githubLogin, setGithubLogin] = useState(currentOrg?.github_login ?? "");
  const [country, setCountry] = useState(currentOrg?.country ?? "KE");
  const [industry, setIndustry] = useState(currentOrg?.industry ?? "technology");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!currentOrg) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("organizations")
      .update({
        website: website || null,
        github_login: githubLogin.replace(/^@/, "") || null,
        country,
        industry,
      })
      .eq("id", currentOrg.id);
    setSaving(false);
    setMessage(error ? error.message : "Saved");
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description={`${currentOrg.name} · signed in as ${user.email}`}
      />
      <form
        onSubmit={save}
        className="max-w-lg space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="github">GitHub organisation or username</Label>
          <Input
            id="github"
            value={githubLogin}
            onChange={(e) => setGithubLogin(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
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
              className="flex h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
            >
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {message && (
          <p className="text-sm text-[var(--muted)]">{message}</p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </form>
      <p className="mt-6 text-sm text-[var(--muted)]">
        Banks and investors query this company through the{" "}
        <a href="/developers" className="text-[var(--accent)] hover:underline">
          VERIQ API
        </a>
        . Scan cadence and outbound webhooks live under{" "}
        <a href="/integrations" className="text-[var(--accent)] hover:underline">
          Integrations
        </a>
        .
      </p>
    </div>
  );
}
