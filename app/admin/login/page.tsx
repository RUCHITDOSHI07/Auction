"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailPassword } from "@/lib/firebase/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signInWithEmailPassword(email.trim(), password);
      const next = new URLSearchParams(window.location.search).get("next");
      const nextPath = next && next.startsWith("/admin") && next !== "/admin/login" ? next : "/admin";
      console.info("Firebase admin authentication verified", {
        uid: result.user.uid,
        email: result.user.email,
        admin: result.claims.admin === true,
      });
      router.replace(nextPath);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="landing">
      <div className="landing-brand">
        <span className="brand-mark">CA</span>
        <span>
          CRICKET
          <br />
          <b>ADMIN</b>
        </span>
      </div>

      <div className="landing-content">
        <span className="eyebrow">ADMIN ACCESS</span>
        <h1>
          Sign in to the
          <br />
          <i>control room.</i>
        </h1>
        <p>Use the Firebase administrator account configured for this auction.</p>

        <form className="form-panel" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="full-field">
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label className="full-field">
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
          </div>
          {error && <p role="alert">{error}</p>}
          <div className="form-actions">
            <button className="button button-dark" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>

      <div className="landing-foot">
        <span>FIREBASE AUTHENTICATION</span>
        <span>Admin access only</span>
      </div>
    </main>
  );
}
