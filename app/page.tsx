import Link from "next/link";
import { BrandWatermark, Mark } from "@/components/ui";
import { Badge } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="public-shell">
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
          <div className="deal-visual floating-panel">
            <div className="visual-top">
              <div>
                <div className="live-pulse">
                  <span className="live-dot" />
                  منافسة مباشرة
                </div>
                <h3>طلب توريد · أرز بسمتي · الرياض</h3>
                <p>RFQ-2841 · يغلق خلال</p>
              </div>
              <div className="countdown">
                <strong>02</strong>
                <strong>14</strong>
                <small>ساعة</small>
                <small>دقيقة</small>
              </div>
            </div>

            <div className="ticker-strip" aria-hidden>
              <span>عرض جديد +٣٫٢٪</span>
              <span>مورد #4 دخل المنافسة</span>
              <span>أفضل سعر ↓ ٤٫٨٪</span>
              <span>ترتيب محدّث</span>
            </div>

            <div className="visual-stats">
              <div>
                <small>عروض نشطة</small>
                <strong>12</strong>
                <span>موردون يتنافسون</span>
              </div>
              <div>
                <small>أفضل سعر</small>
                <strong>١٨٫٤</strong>
                <span>ر.س / كجم</span>
              </div>
              <div>
                <small>انخفاض</small>
                <strong className="delta-down">−١١٪</strong>
                <span>منذ الافتتاح</span>
              </div>
            </div>

            <div className="rank-panel">
              <div className="rank-row is-lead">
                <span className="rank-pos">١</span>
                <div>
                  <strong>مؤسسة النخيل للتوريد</strong>
                  <small>تسليم ٧ أيام · تقييم ٩٤</small>
                </div>
                <b>١٨٫٤٠</b>
              </div>
              <div className="rank-row">
                <span className="rank-pos">٢</span>
                <div>
                  <strong>شركة آفاق اللوجستية</strong>
                  <small>تسليم ١٠ أيام · تقييم ٩١</small>
                </div>
                <b>١٨٫٩٥</b>
              </div>
              <div className="rank-row">
                <span className="rank-pos">٣</span>
                <div>
                  <strong>مجموعة البركة</strong>
                  <small>تسليم ٥ أيام · تقييم ٨٨</small>
                </div>
                <b>١٩٫٢٠</b>
              </div>
            </div>

            <div className="sparkline" aria-hidden>
              <svg viewBox="0 0 320 64" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(201,169,110,.35)" />
                    <stop offset="100%" stopColor="rgba(201,169,110,0)" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,48 C40,46 60,40 90,36 C120,32 140,28 170,22 C200,16 230,24 260,14 C290,6 310,10 320,8 L320,64 L0,64 Z"
                  fill="url(#sparkFill)"
                />
                <path
                  d="M0,48 C40,46 60,40 90,36 C120,32 140,28 170,22 C200,16 230,24 260,14 C290,6 310,10 320,8"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="2.2"
                />
              </svg>
              <small>اتجاه السعر أثناء المنافسة</small>
            </div>

            <div className="visual-note">
              <span className="shield">◆</span>
              <div>
                <strong>العروض مشفّرة حتى الإغلاق</strong>
                <small>ترسية موثقة · مقارنة ذكية · أثر تدقيقي كامل</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="numbers">
        <div>
          <strong>٣٫٢×</strong>
          <span>متوسط عدد العروض لكل طلب</span>
        </div>
        <div>
          <strong>١٨٪</strong>
          <span>توفير متوسط عبر المنافسة</span>
        </div>
        <div>
          <strong>&lt; ٤٨س</strong>
          <span>من الطلب إلى أفضل عرض</span>
        </div>
        <div>
          <strong>١٠٠٪</strong>
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
            أحتاج ٤٠ طن أرز بسمتي للرياض خلال ١٠ أيام، جودة تصدير.
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
              <b>٤٠ طن</b>
            </span>
            <span>
              المدينة
              <b>الرياض</b>
            </span>
            <span>
              الموعد
              <b>١٠ أيام</b>
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
