"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="content" style={{ padding: 40, textAlign: "center" }}>
      <h2 style={{ color: "var(--deep)" }}>حدث خطأ غير متوقع</h2>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        {error.message || "تعذر إكمال الطلب."}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button className="btn primary" type="button" onClick={reset}>
          إعادة المحاولة
        </button>
        <Link className="btn outline" href="/">
          الرئيسية
        </Link>
      </div>
    </main>
  );
}
