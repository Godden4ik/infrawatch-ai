"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? `HTTP ${response.status}`);
        setSubmitting(false);
        return;
      }
      const dest = params.get("from") || "/";
      router.replace(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
      <Card className="w-full p-0">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1.5">
            <div className="flex h-9 w-9 items-center justify-center border border-border/60 bg-muted/40 text-muted-foreground">
              <KeyRound className="h-4 w-4" />
            </div>
            <h1 className="font-mono text-base font-semibold tracking-tight">
              InfraWatch · Restricted Demo
            </h1>
            <p className="text-xs text-muted-foreground">
              This deployment is gated. Enter the access password to continue.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
              >
                Access password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="font-mono"
              />
            </div>

            {error && (
              <p className="bg-status-critical-soft px-3 py-2 font-mono text-xs text-status-critical">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting || !password}
              className="w-full justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              Enter
            </Button>
          </form>

          <p className="font-mono text-[10px] text-muted-foreground/60">
            Cookie persists for 12 h. Use the logout action in the header to
            clear.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
