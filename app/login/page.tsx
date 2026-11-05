import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="content" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>جارٍ التحميل...</p>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
