"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFrame } from "@/components/auth-frame";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthFrame kicker="Workspace" title="Sign in">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-5 rounded-xl bg-[rgba(255,90,115,0.12)] px-3 py-2 text-sm text-[var(--critical)]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        <Button type="submit" className="mt-7 w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          No account?{" "}
          <Link href="/signup" className="font-medium text-[var(--accent)] hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
