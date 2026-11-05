"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const ar = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

type Supplier = { name: string; days: number; rating: number; price: number; flash?: number };

const OPENING_PRICE = 20.7;
const TICKER = [
  "عرض جديد من مؤسسة النخيل",
  "مورد جديد دخل المنافسة",
  "أفضل سعر نزل الحين",
  "الترتيب اتحدث",
  "مجموعة البركة خفضت سعرها",
  "طلب جديد من مقهى بالرياض",
];

export function LiveDealPanel() {
  const [secondsLeft, setSecondsLeft] = useState(2 * 3600 + 14 * 60 + 37);
  const [offers, setOffers] = useState(12);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<number[]>([20.7, 20.4, 20.1, 19.8, 19.6, 19.3, 19.0, 18.8, 18.6, 18.4]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    { name: "مؤسسة النخيل للتوريد", days: 7, rating: 94, price: 18.4 },
    { name: "شركة آفاق اللوجستية", days: 10, rating: 91, price: 18.95 },
    { name: "مجموعة البركة", days: 5, rating: 88, price: 19.2 },
  ]);

  useEffect(() => {
    const clock = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    const market = setInterval(() => {
      setTick((t) => t + 1);
      setSuppliers((list) => {
        const i = Math.floor(Math.random() * list.length);
        const next = list.map((s, idx) => {
          if (idx !== i) return { ...s, flash: undefined };
          const drop = 0.05 + Math.random() * 0.2;
          return { ...s, price: Math.max(16.9, +(s.price - drop).toFixed(2)), flash: Date.now() };
        });
        const best = Math.min(...next.map((s) => s.price));
        setHistory((h) => [...h.slice(-13), best]);
        return [...next].sort((a, b) => a.price - b.price);
      });
      setOffers((o) => (Math.random() < 0.45 && o < 24 ? o + 1 : o));
    }, 2600);
    return () => {
      clearInterval(clock);
      clearInterval(market);
    };
  }, []);

  const best = suppliers[0].price;
  const drop = ((OPENING_PRICE - best) / OPENING_PRICE) * 100;
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;

  const spark = useMemo(() => {
    const min = Math.min(...history) - 0.2;
    const max = Math.max(...history) + 0.2;
    // lower price = better = higher line
    const flipped = history.map((v, i) => {
      const x = (i / (history.length - 1)) * 320;
      const y = 8 + ((v - min) / (max - min)) * 48;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${flipped.join(" L")}`;
  }, [history]);

  return (
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
          <strong>{ar(h).padStart(2, "0")}</strong>
          <strong>{ar(m).padStart(2, "0")}</strong>
          <strong className="live-seconds">{ar(s).padStart(2, "0")}</strong>
          <small>ساعة</small>
          <small>دقيقة</small>
          <small>ثانية</small>
        </div>
      </div>

      <div className="ticker-strip live-ticker" aria-live="polite">
        <span key={tick} className="ticker-in">
          {TICKER[tick % TICKER.length]}
        </span>
      </div>

      <div className="visual-stats">
        <div>
          <small>عروض نشطة</small>
          <strong key={offers} className="pop">{ar(offers)}</strong>
          <span>موردون يتنافسون</span>
        </div>
        <div>
          <small>أفضل سعر</small>
          <strong key={best} className="pop">{ar(best, 2)}</strong>
          <span>ر.س / كجم</span>
        </div>
        <div>
          <small>انخفاض</small>
          <strong className="delta-down">−{ar(drop, 1)}%</strong>
          <span>منذ الافتتاح</span>
        </div>
      </div>

      <div className="rank-panel">
        {suppliers.map((sup, idx) => (
          <div
            key={sup.name}
            className={`rank-row${idx === 0 ? " is-lead" : ""}${sup.flash ? " price-flash" : ""}`}
          >
            <span className="rank-pos">{ar(idx + 1)}</span>
            <div>
              <strong>{sup.name}</strong>
              <small>
                تسليم {ar(sup.days)} أيام · تقييم {ar(sup.rating)}
              </small>
            </div>
            <b>{ar(sup.price, 2)}</b>
          </div>
        ))}
      </div>

      <div className="sparkline" aria-hidden>
        <svg viewBox="0 0 320 64" preserveAspectRatio="none">
          <path d={`${spark} L320,64 L0,64 Z`} fill="rgba(227,207,166,.16)" />
          <path d={spark} fill="none" stroke="#e3cfa6" strokeWidth="2.4" />
        </svg>
        <small>اتجاه أفضل سعر أثناء المنافسة</small>
      </div>

      <div className="visual-note">
        <span className="shield">◆</span>
        <div>
          <strong>العروض مشفرة حتى الإغلاق</strong>
          <small>ترسية موثقة · مقارنة ذكية · أثر تدقيقي كامل</small>
        </div>
      </div>
    </div>
  );
}

export function CountUp({
  to,
  digits = 0,
  prefix = "",
  suffix = "",
  duration = 1600,
}: {
  to: number;
  digits?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(to * eased);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <strong ref={ref}>
      {prefix}
      {ar(value, digits)}
      {suffix}
    </strong>
  );
}
