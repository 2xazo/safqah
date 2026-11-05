import Link from "next/link";
import { BrandWatermark, Mark } from "@/components/ui";

export default function UnauthorizedPage() {
  return (
    <main className="public-shell" style={{ minHeight: "100vh" }}>
      <BrandWatermark />
      <header className="topbar">
        <Link href="/">
          <Mark />
        </Link>
      </header>
      <section className="section" style={{ textAlign: "center", paddingTop: 80 }}>
        <h2 style={{ color: "var(--deep)" }}>غير مصرح بالوصول</h2>
        <p style={{ color: "var(--muted)" }}>
          حسابك لا يملك صلاحية عرض هذه الصفحة.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link className="btn primary" href="/login">
            تسجيل الدخول
          </Link>
          <Link className="btn outline" href="/">
            الصفحة الرئيسية
          </Link>
        </div>
      </section>
    </main>
  );
}
