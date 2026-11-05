import Link from "next/link";
import { BrandWatermark, Mark } from "@/components/ui";
import { Badge } from "@/components/ui";
import { CountUp, LiveDealPanel } from "@/components/landing-live";

export default function HomePage() {
  return (
    <main className="public-shell landing-light">
      <BrandWatermark />
      <div className="ambient-grid" aria-hidden />
      <div className="ambient-glow" aria-hidden />

      <header className="topbar">
        <Mark />
        <nav className="desktop-nav" aria-label="التنقل الرئيسي">
          <a href="#how">كيف تعمل؟</a>
          <a href="#buyers">للمشترين</a>
          <a href="#suppliers">للموردين</a>
        </nav>
        <div className="top-actions">
          <Link className="btn ghost" href="/login">
            دخول
          </Link>
          <Link className="btn primary" href="/login">
            ابدأ الآن
          </Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <Badge tone="gold">مشتريات تنافسية · مدعومة بالذكاء الاصطناعي</Badge>
          <h1>
            ساحة تداول
            <br />
            <span>للمشتريات المؤسسية.</span>
          </h1>
          <p>
            صفقة تجمع احتياج منشأتك مع منافسة مباشرة بين موردين مؤهلين — عروض
            حية، ترتيب لحظي، وقرار ترسية أوضح وأسرع.
          </p>
          <div className="hero-actions">
            <Link className="btn primary large" href="/login?role=buyer">
              ابدأ كمشتري <span>←</span>
            </Link>
            <Link className="btn outline large" href="/login?role=supplier">
              انضم كمورد
            </Link>
          </div>
          <div className="trust-line">
            <span>✓ موردون مؤهلون</span>
            <span>✓ عروض سرية ومباشرة</span>
            <span>✓ قرار بشري موثق</span>
          </div>
        </div>

        <div className="hero-stage">
          <LiveDealPanel />
        </div>
      </section>

      <section className="numbers">
        <div>
          <CountUp to={3.2} digits={1} suffix="×" />
          <span>متوسط عدد العروض لكل طلب</span>
        </div>
        <div>
          <CountUp to={18} suffix="%" />
          <span>توفير متوسط عبر المنافسة</span>
        </div>
        <div>
          <CountUp to={48} prefix="< " suffix="س" />
          <span>من الطلب إلى أفضل عرض</span>
        </div>
        <div>
          <CountUp to={100} suffix="%" />
          <span>مسار قرار قابل للتدقيق</span>
        </div>
      </section>

      <section className="section how" id="how">
        <div className="section-heading">
          <span>كيف تعمل صفقة؟</span>
          <h2>من الاحتياج إلى التوريد، بخمس خطوات</h2>
          <p>إجراءات مشتريات احترافية بسرعة منصة تداول.</p>
        </div>
        <div className="steps-grid">
          {[
            ["01", "أرسل احتياجك", "اكتب طلبك بطريقتك أو استخدم النموذج."],
            ["02", "نجمع الطلبات", "نضم الطلبات المتوافقة لنصنع كمية أكبر."],
            ["03", "نطرح المنافسة", "ندعو الموردين المؤهلين لعروض سرية."],
            ["04", "نقارن بوضوح", "نقيّم السعر والجودة والتوصيل والصلاحية."],
            ["05", "وافق واستلم", "راجع عرضك النهائي وتابع التوريد."],
          ].map(([num, title, text]) => (
            <article className="step-card" key={num}>
              <span>{num}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split-section" id="buyers">
        <div className="split-copy">
          <span className="eyebrow">للمشترين</span>
          <h2>اشترِ بقوة المنشآت الكبيرة</h2>
          <p>
            صفقة تحول طلبك اليومي إلى عملية شراء منظمة وتنافسية، وتحفظ لك كل
            خطوة من المواصفات حتى الاستلام.
          </p>
          <ul>
            <li>أسعار وشروط أكثر تنافسية</li>
            <li>موردون موثقون ومقارنة شفافة</li>
            <li>أوامر شراء وتوريدات في مكان واحد</li>
          </ul>
          <Link className="btn primary" href="/login?role=buyer">
            ابدأ كمشتري
          </Link>
        </div>
        <div className="assistant-card floating-panel">
          <div className="assistant-head">
            <span className="ai-orb">✦</span>
            <div>
              <strong>مساعد المشتريات الذكي</strong>
              <small>استخراج مواصفات · مطابقة موردين · ترتيب عروض</small>
            </div>
          </div>
          <div className="chat buyer-chat">
            أحتاج 40 طن أرز بسمتي للرياض خلال 10 أيام، جودة تصدير.
          </div>
          <div className="chat ai-chat">
            <strong>تم تجهيز طلب الشراء</strong>
            <span>
              الكمية · المدينة · الموعد · التصنيف — جاهز للنشر على السوق.
            </span>
          </div>
          <div className="extracted">
            <span>
              الكمية
              <b>40 طن</b>
            </span>
            <span>
              المدينة
              <b>الرياض</b>
            </span>
            <span>
              الموعد
              <b>10 أيام</b>
            </span>
          </div>
        </div>
      </section>

      <section className="cta" id="suppliers">
        <div>
          <span>ابدأ اليوم</span>
          <h2>اجعل مشتريات منشأتك أكثر ذكاءً</h2>
          <p>تجربة مبسطة للمشتري، وفرص أكبر للمورد، وقرار أوضح للجميع.</p>
        </div>
        <div>
          <Link className="btn gold large" href="/login?role=buyer">
            ابدأ كمشتري
          </Link>
          <Link className="btn light-outline large" href="/login?role=supplier">
            انضم كمورد
          </Link>
          <Link className="btn light-outline large" href="/login?role=admin">
            دخول المسؤول
          </Link>
        </div>
      </section>

      <footer>
        <Mark />
        <p>منصة سعودية للمشتريات والمنافسات بين المنشآت والموردين.</p>
        <span>© 2026 صفقة</span>
      </footer>
    </main>
  );
}
