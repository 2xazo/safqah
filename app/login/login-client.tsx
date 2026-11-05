"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandWatermark, Mark } from "@/components/ui";
import { DEMO_ACCOUNTS } from "@/lib/constants";
import {
  demoLoginFormAction,
  loginFormAction,
  type AuthState,
} from "@/app/actions/auth";

const initialState: AuthState = { error: null };

const PUBLIC_DEMO_ACCOUNTS = DEMO_ACCOUNTS.filter(
  (account) => account.role === "buyer" || account.role === "supplier",
);

export default function LoginClient() {
  const searchParams = useSearchParams();
  const roleHint = searchParams.get("role");
  const [state, formAction, pending] = useActionState(
    loginFormAction,
    initialState,
  );
  const [demoState, demoAction, demoPending] = useActionState(
    demoLoginFormAction,
    initialState,
  );

  const highlighted = PUBLIC_DEMO_ACCOUNTS.filter((account) =>
    roleHint === "buyer" || roleHint === "supplier"
      ? account.role === roleHint
      : true,
  );

  const error = state?.error ?? demoState?.error ?? null;

  return (
    <main className="public-shell" style={{ minHeight: "100vh" }}>
      <BrandWatermark />
      <div className="ambient-grid" aria-hidden />
      <div className="ambient-glow" aria-hidden />

      <header className="topbar">
        <Mark />
        <div className="top-actions">
          <Link className="btn ghost" href="/">
            العودة للموقع
          </Link>
        </div>
      </header>

      <section
        className="section"
        style={{ maxWidth: 920, margin: "0 auto", paddingTop: 48 }}
      >
        <div className="section-heading">
          <span>تسجيل الدخول</span>
          <h2>ادخل إلى مركز عمليات صفقة</h2>
          <p>سجّل الدخول بالبريد وكلمة المرور، أو استخدم حسابًا تجريبيًا.</p>
        </div>

        <div
          className="login-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr .9fr",
            gap: 18,
          }}
        >
          <section className="panel floating-panel">
            <h3 style={{ marginTop: 0 }}>حسابات تجريبية</h3>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>
              دخول بنقرة واحدة للتجربة المحلية (يتطلب بيانات البذرة في قاعدة
              البيانات).
            </p>
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              {highlighted.map((account) => (
                <form action={demoAction} key={account.email}>
                  <input type="hidden" name="role" value={account.role} />
                  <button
                    type="submit"
                    className="btn outline wide"
                    style={{ textAlign: "right" }}
                    disabled={demoPending}
                  >
                    <strong style={{ display: "block" }}>{account.label}</strong>
                    <small style={{ color: "var(--muted)" }}>
                      {account.email}
                    </small>
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3 style={{ marginTop: 0 }}>البريد وكلمة المرور</h3>
            <form
              action={formAction}
              className="fields"
              style={{ display: "grid", gap: 12 }}
            >
              <label style={{ gridColumn: "1 / -1" }}>
                البريد الإلكتروني
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  dir="ltr"
                  defaultValue={
                    PUBLIC_DEMO_ACCOUNTS.find((a) => a.role === roleHint)
                      ?.email ?? ""
                  }
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                كلمة المرور
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  dir="ltr"
                />
              </label>
              {error ? (
                <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>
                  {error}
                </p>
              ) : null}
              <button
                className="btn primary wide"
                type="submit"
                disabled={pending}
                style={{ gridColumn: "1 / -1" }}
              >
                {pending ? "جارٍ الدخول..." : "تسجيل الدخول"}
              </button>
            </form>
          </section>
        </div>
      </section>
      <style>{`
        @media (max-width: 800px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .floating-panel { animation: none; }
        }
      `}</style>
    </main>
  );
}
