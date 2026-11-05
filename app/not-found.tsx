import Link from "next/link";
import { BrandWatermark, Mark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="public-shell" style={{ minHeight: "100vh" }}>
      <BrandWatermark />
      <header className="topbar">
        <Link href="/">
          <Mark />
        </Link>
      </header>
      <section className="section" style={{ textAlign: "center", paddingTop: 80 }}>
        <h2 style={{ color: "var(--deep)" }}>الصفحة غير موجودة</h2>
        <p style={{ color: "var(--muted)" }}>تعذر العثور على المسار المطلوب.</p>
        <Link className="btn primary" href="/">
          العودة للرئيسية
        </Link>
      </section>
    </main>
  );
}
