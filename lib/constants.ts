export const BUYER_NAV = [
  { href: "/buyer", label: "الرئيسية" },
  { href: "/buyer/requests/new", label: "إنشاء طلب" },
  { href: "/buyer/requests", label: "طلباتي" },
  { href: "/buyer/offers", label: "مقارنة العروض" },
  { href: "/buyer/purchase-orders", label: "أوامر الشراء" },
] as const;

export const SUPPLIER_NAV = [
  { href: "/supplier", label: "الرئيسية" },
  { href: "/supplier/opportunities", label: "فرص التوريد" },
  { href: "/supplier/offers", label: "عروضي" },
  { href: "/supplier/purchase-orders", label: "أوامر التوريد" },
  { href: "/supplier/profile", label: "ملف المورد" },
] as const;

/** Kept for support tooling; not part of primary buyer/supplier MVP nav. */
export const ADMIN_NAV = [
  { href: "/admin", label: "الرئيسية" },
  { href: "/admin/purchase-requests", label: "طلبات الشراء" },
  { href: "/admin/purchase-orders", label: "أوامر الشراء" },
  { href: "/admin/complaints", label: "البلاغات" },
  { href: "/admin/audit-log", label: "سجل العمليات" },
] as const;

export const DEMO_ACCOUNTS = [
  {
    role: "buyer" as const,
    email: "buyer@safqah.demo",
    password: "SafqahDemo1!",
    label: "حساب المشتري التجريبي",
  },
  {
    role: "supplier" as const,
    email: "supplier@safqah.demo",
    password: "SafqahDemo1!",
    label: "حساب المورد التجريبي",
  },
  {
    role: "admin" as const,
    email: "admin@safqah.demo",
    password: "SafqahDemo1!",
    label: "حساب المسؤول التجريبي (دعم)",
  },
] as const;

export const TAX_RATE = 0.15;

export const OFFER_SCORE_WEIGHTS = {
  price: 0.5,
  delivery: 0.3,
  rating: 0.2,
} as const;
