import { createHash } from "node:crypto";
import { hashSync } from "bcryptjs";
import { config as loadEnv } from "dotenv";
import type { InferInsertModel } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getDb, closeDb, applySqlMigrations } from "./index";
import {
  auditLogs,
  branches,
  buyerProfiles,
  categories,
  deliveryAddresses,
  fulfillmentEvents,
  notifications,
  offerItems,
  offerScores,
  offers,
  organizationMembers,
  organizations,
  products,
  purchaseOrderItems,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequestStatusHistory,
  purchaseRequests,
  supplierCategories,
  supplierProfiles,
  users,
} from "./schema";
import { DEMO_SERVICE_CITIES } from "../lib/saudi-cities";

// Mirrors Next.js precedence: real environment variables > .env.local > .env.
loadEnv({ path: [".env.local", ".env"], quiet: true });

const db = getDb();

const DEMO_PASSWORD = "SafqahDemo1!";
const PASSWORD_HASH = hashSync(DEMO_PASSWORD, 10);
const CITY = "الرياض";
const TAX_RATE = 0.15;

/**
 * UUID v5 over a fixed namespace so every rerun produces the exact same
 * primary keys and the upserts stay idempotent.
 */
const SEED_NAMESPACE = "4b4a3c2d1e0f4a5b9c8d7e6f5a4b3c2d";

function seedId(key: string): string {
  const digest = createHash("sha1")
    .update(Buffer.from(SEED_NAMESPACE, "hex"))
    .update(key, "utf8")
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function at(iso: string) {
  const value = new Date(iso);
  return { createdAt: value, updatedAt: value };
}

function money(value: number): string {
  return value.toFixed(2);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Mirrors lib/workflow.ts daysBetweenDates, using UTC for deterministic seed output. */
function daysBetween(a: string, b: string): number {
  const start = new Date(a);
  const end = new Date(b);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

const counts: Record<string, number> = {};

async function upsert<T extends PgTable & { id: PgColumn }>(
  label: string,
  table: T,
  rows: InferInsertModel<T>[],
): Promise<void> {
  for (const row of rows) {
    const set = { ...(row as Record<string, unknown>) };
    delete set.id;
    await db
      .insert(table)
      .values(row as never)
      .onConflictDoUpdate({ target: table.id, set: set as never });
  }
  counts[label] = (counts[label] ?? 0) + rows.length;
}

/* ------------------------------------------------------------------ */
/* Key helpers                                                         */
/* ------------------------------------------------------------------ */

const buyerOrgKey = (slug: string) => `org:buyer:${slug}`;
const supplierOrgKey = (slug: string) => `org:supplier:${slug}`;
const userKey = (email: string) => `user:${email}`;
const branchKey = (slug: string) => `branch:${slug}:primary`;
const addressKey = (slug: string) => `address:${slug}:primary`;
const categoryKey = (slug: string) => `category:${slug}`;
const productKey = (sku: string) => `product:${sku}`;

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

const CATEGORY_SEEDS = [
  { slug: "oils", name: "زيوت وسمن" },
  { slug: "dry-goods", name: "مواد جافة وبقالة" },
  { slug: "cleaning", name: "منظفات وتعقيم" },
  { slug: "packaging", name: "التعبئة والتغليف" },
  { slug: "equipment", name: "معدات ومطابخ" },
  { slug: "furniture", name: "أثاث وتجهيزات" },
  { slug: "other", name: "أخرى" },
] as const;

/** Optional catalog products — food items only. Furniture/equipment demos use free text. */
const PRODUCT_SEEDS = [
  {
    sku: "OIL-17L",
    categorySlug: "oils",
    name: "زيت قلي نباتي 17 لتر",
    unitLabel: "عبوة 17 لتر",
    description:
      "زيت نباتي مخصص للقلي العميق في المطاعم، معبأ في عبوة سعة 17 لترًا ومطابق لاشتراطات الهيئة العامة للغذاء والدواء.",
  },
  {
    sku: "RICE-40KG",
    categorySlug: "dry-goods",
    name: "أرز بسمتي فاخر",
    unitLabel: "كيس 40 كجم",
    description: "أرز بسمتي طويل الحبة معبأ في أكياس سعة 40 كيلوجرامًا.",
  },
  {
    sku: "FLOUR-45KG",
    categorySlug: "dry-goods",
    name: "دقيق مخابز فاخر",
    unitLabel: "كيس 45 كجم",
    description: "دقيق قمح فاخر مخصص للمخابز والمعجنات.",
  },
  {
    sku: "CLEAN-20L",
    categorySlug: "cleaning",
    name: "منظف أرضيات مركّز 20 لتر",
    unitLabel: "عبوة 20 لتر",
    description: "منظف أرضيات مركّز مناسب للمطاعم والمنشآت الغذائية.",
  },
] as const;

type BuyerSeed = {
  slug: string;
  name: string;
  nameEn: string;
  commercialRegister: string;
  cuisineType: string;
  monthlySpend: string;
  district: string;
  branchName: string;
  street: string;
  email: string;
  contactName: string;
  phone: string;
};

const BUYERS: BuyerSeed[] = [
  {
    slug: "al-nakheel",
    name: "مطعم النخيل",
    nameEn: "Al Nakheel Restaurant",
    commercialRegister: "1010250011",
    cuisineType: "مأكولات سعودية",
    monthlySpend: "185000.00",
    district: "الياسمين",
    branchName: "فرع الياسمين",
    street: "طريق أنس بن مالك",
    email: "buyer@safqah.demo",
    contactName: "فهد بن سعد النخيل",
    phone: "0551000100",
  },
  {
    slug: "al-waha",
    name: "مقهى الواحة",
    nameEn: "Al Waha Cafe",
    commercialRegister: "1010250012",
    cuisineType: "مقهى ومشروبات",
    monthlySpend: "62000.00",
    district: "العليا",
    branchName: "فرع العليا",
    street: "طريق العروبة",
    email: "buyer2@safqah.demo",
    contactName: "نورة بنت عبدالله المطيري",
    phone: "0551000200",
  },
];

type SupplierSeed = {
  slug: string;
  name: string;
  nameEn: string;
  commercialRegister: string;
  ratingAverage: string;
  ratingCount: number;
  complianceScore: number;
  deliveryLeadDays: number;
  about: string;
  categories: string[];
  email: string;
  contactName: string;
  phone: string;
};

const SUPPLIERS: SupplierSeed[] = [
  {
    slug: "advanced-supply",
    name: "شركة الإمداد المتقدمة",
    nameEn: "Advanced Supply Company",
    commercialRegister: "4030250021",
    ratingAverage: "4.60",
    ratingCount: 32,
    complianceScore: 98,
    deliveryLeadDays: 2,
    about: "مورد رائد لمستلزمات المطاعم والمقاهي في مدينة الرياض.",
    categories: ["oils", "dry-goods", "packaging", "equipment"],
    email: "supplier@safqah.demo",
    contactName: "ناصر بن عبدالله القحطاني",
    phone: "0552000201",
  },
  {
    slug: "food-resources",
    name: "شركة موارد الغذاء",
    nameEn: "Food Resources Company",
    commercialRegister: "4030250022",
    ratingAverage: "4.30",
    ratingCount: 21,
    complianceScore: 93,
    deliveryLeadDays: 3,
    about: "متخصصون في توريد المواد الغذائية الجافة والزيوت ومستلزمات التنظيف.",
    categories: ["oils", "dry-goods", "cleaning"],
    email: "supplier2@safqah.demo",
    contactName: "إبراهيم بن سعود الحربي",
    phone: "0552000202",
  },
  {
    slug: "supply-corner",
    name: "مؤسسة ركن التوريد",
    nameEn: "Supply Corner Establishment",
    commercialRegister: "4030250023",
    ratingAverage: "4.10",
    ratingCount: 14,
    complianceScore: 90,
    deliveryLeadDays: 3,
    about: "تغطي احتياجات المنشآت من التنظيف والتغليف والمعدات والأثاث التجاري.",
    categories: ["dry-goods", "cleaning", "packaging", "equipment", "furniture"],
    email: "supplier3@safqah.demo",
    contactName: "منصور بن عايض الشهري",
    phone: "0552000203",
  },
];

const RATING_BY_SLUG: Record<string, number> = Object.fromEntries(
  SUPPLIERS.map((supplier) => [supplier.slug, Number(supplier.ratingAverage)]),
);

/* ------------------------------------------------------------------ */
/* Purchase request scenarios (direct RFQ)                             */
/* ------------------------------------------------------------------ */

type FulfillmentStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered";

type ReqItemSeed = {
  key: string;
  productSku?: string;
  productName: string;
  quantity: number;
  unitLabel: string;
  specificationNotes?: string;
  description?: string;
};

type OfferItemSeed = {
  reqItemKey: string;
  offeredProductName: string;
  brandName?: string;
  specificationNote?: string;
  availableQuantity: number;
  unitPrice: number;
};

type OfferOutcome = "open" | "selected" | "not_selected";

type OfferSeed = {
  code: string;
  supplierSlug: string;
  proposedDeliveryDate: string;
  deliveryFee: number;
  paymentTerms?: string;
  notes?: string;
  submittedAt: string;
  outcome: OfferOutcome;
  items: OfferItemSeed[];
};

type FulfillmentEventSeed = {
  from: FulfillmentStatus | null;
  to: FulfillmentStatus;
  note: string;
  at: string;
  actorEmail: string;
};

type PurchaseOrderSeed = {
  code: string;
  fulfillmentStatus: FulfillmentStatus;
  receiptStatus: "pending" | "received_full" | "received_with_issue";
  issuedAt: string;
  events: FulfillmentEventSeed[];
  receiptEvent?: { note: string; at: string; actorEmail: string };
};

type PurchaseRequestSeed = {
  code: string;
  buyerSlug: string;
  createdByEmail: string;
  categorySlug: string;
  title: string;
  notes: string;
  neededByDate: string;
  submissionDeadline: string;
  publishedAt: string;
  awardedAt?: string;
  finalStatus: "published" | "awarded" | "closed";
  items: ReqItemSeed[];
  offers: OfferSeed[];
  computeScores?: boolean;
  selectedOfferCode?: string;
  purchaseOrder?: PurchaseOrderSeed;
};

const PURCHASE_REQUESTS: PurchaseRequestSeed[] = [
  /* 1. Open request, no offers yet — cleaning supplies. */
  {
    code: "PR-2026-0001",
    buyerSlug: "al-nakheel",
    createdByEmail: "buyer@safqah.demo",
    categorySlug: "cleaning",
    title: "توريد مستلزمات تنظيف دورية للمطبخ",
    notes: "نحتاج تجديد مخزون مواد التنظيف الأسبوعي للفرع الرئيسي.",
    neededByDate: "2026-11-16",
    submissionDeadline: "2026-11-11T15:00:00Z",
    publishedAt: "2026-11-01T09:00:00Z",
    finalStatus: "published",
    items: [
      {
        key: "clean-20l",
        productSku: "CLEAN-20L",
        productName: "منظف أرضيات مركّز 20 لتر",
        quantity: 10,
        unitLabel: "عبوة 20 لتر",
        specificationNotes: "مطابق لاشتراطات السلامة الغذائية المعتمدة.",
      },
      {
        key: "wipes",
        productName: "مناديل تنظيف قماشية للمطبخ",
        quantity: 100,
        unitLabel: "قطعة",
        description: "مناديل ميكروفايبر قابلة للغسل وإعادة الاستخدام.",
      },
    ],
    offers: [],
  },

  /* 2. Open request with 1-2 offers, future deadline — cooking oil. */
  {
    code: "PR-2026-0002",
    buyerSlug: "al-nakheel",
    createdByEmail: "buyer@safqah.demo",
    categorySlug: "oils",
    title: "توريد زيت قلي نباتي للفرع الرئيسي",
    notes: "زيت قلي عميق للاستخدام اليومي في المطبخ.",
    neededByDate: "2026-11-18",
    submissionDeadline: "2026-11-13T15:00:00Z",
    publishedAt: "2026-11-02T08:00:00Z",
    finalStatus: "published",
    items: [
      {
        key: "oil-17l",
        productSku: "OIL-17L",
        productName: "زيت قلي نباتي 17 لتر",
        quantity: 20,
        unitLabel: "عبوة 17 لتر",
        specificationNotes: "صلاحية لا تقل عن 12 شهرًا عند التسليم.",
      },
    ],
    offers: [
      {
        code: "OFR-2026-0001",
        supplierSlug: "advanced-supply",
        proposedDeliveryDate: "2026-11-09",
        deliveryFee: 150,
        paymentTerms: "الدفع خلال 15 يومًا من الاستلام",
        notes: "توريد كامل الكمية خلال يومي عمل من صدور أمر الشراء.",
        submittedAt: "2026-11-02T14:00:00Z",
        outcome: "open",
        items: [
          {
            reqItemKey: "oil-17l",
            offeredProductName: "زيت قلي نباتي 17 لتر - نقاء برو",
            brandName: "نقاء برو",
            availableQuantity: 20,
            unitPrice: 118,
          },
        ],
      },
      {
        code: "OFR-2026-0002",
        supplierSlug: "food-resources",
        proposedDeliveryDate: "2026-11-11",
        deliveryFee: 180,
        paymentTerms: "الدفع عند الاستلام",
        notes: "يشمل السعر الشحن داخل مدينة الرياض.",
        submittedAt: "2026-11-02T16:30:00Z",
        outcome: "open",
        items: [
          {
            reqItemKey: "oil-17l",
            offeredProductName: "زيت قلي نباتي 17 لتر - زيتنا الذهبي",
            brandName: "زيتنا الذهبي",
            availableQuantity: 20,
            unitPrice: 114,
          },
        ],
      },
    ],
  },

  /* 3. Deadline passed, three offers with scored recommendations. */
  {
    code: "PR-2026-0003",
    buyerSlug: "al-waha",
    createdByEmail: "buyer2@safqah.demo",
    categorySlug: "dry-goods",
    title: "توريد أرز بسمتي فاخر للمقهى",
    notes: "الكمية مطلوبة لتغطية قائمة الأطباق الجديدة.",
    neededByDate: "2026-11-01",
    submissionDeadline: "2026-10-30T15:00:00Z",
    publishedAt: "2026-10-22T09:00:00Z",
    finalStatus: "published",
    items: [
      {
        key: "rice-40kg",
        productSku: "RICE-40KG",
        productName: "أرز بسمتي فاخر",
        quantity: 15,
        unitLabel: "كيس 40 كجم",
        specificationNotes: "صلاحية لا تقل عن 9 أشهر عند التسليم.",
      },
    ],
    offers: [
      {
        code: "OFR-2026-0003",
        supplierSlug: "advanced-supply",
        proposedDeliveryDate: "2026-11-02",
        deliveryFee: 90,
        paymentTerms: "الدفع خلال 30 يومًا",
        notes: "يشمل التوريد فحص جودة قبل الشحن.",
        submittedAt: "2026-10-25T10:00:00Z",
        outcome: "open",
        items: [
          {
            reqItemKey: "rice-40kg",
            offeredProductName: "أرز بسمتي فاخر - علامة ألفا",
            brandName: "ألفا",
            availableQuantity: 15,
            unitPrice: 148,
          },
        ],
      },
      {
        code: "OFR-2026-0004",
        supplierSlug: "food-resources",
        proposedDeliveryDate: "2026-11-04",
        deliveryFee: 110,
        notes: "إمكانية تعديل الكمية بعد التأكيد.",
        submittedAt: "2026-10-26T11:00:00Z",
        outcome: "open",
        items: [
          {
            reqItemKey: "rice-40kg",
            offeredProductName: "أرز بسمتي فاخر - علامة الديرة",
            brandName: "الديرة",
            availableQuantity: 15,
            unitPrice: 135,
          },
        ],
      },
      {
        code: "OFR-2026-0005",
        supplierSlug: "supply-corner",
        proposedDeliveryDate: "2026-11-01",
        deliveryFee: 85,
        notes: "شحنة جاهزة للتسليم الفوري.",
        submittedAt: "2026-10-27T09:30:00Z",
        outcome: "open",
        items: [
          {
            reqItemKey: "rice-40kg",
            offeredProductName: "أرز بسمتي فاخر - علامة وفرة",
            brandName: "وفرة",
            availableQuantity: 15,
            unitPrice: 140,
          },
        ],
      },
    ],
    computeScores: true,
  },

  /* 4. Awarded with purchase order, fulfillment confirmed. */
  {
    code: "PR-2026-0004",
    buyerSlug: "al-nakheel",
    createdByEmail: "buyer@safqah.demo",
    categorySlug: "dry-goods",
    title: "توريد دقيق مخابز فاخر",
    notes: "دقيق فاخر مخصص للمخبوزات اليومية في الفرع.",
    neededByDate: "2026-11-05",
    submissionDeadline: "2026-10-28T15:00:00Z",
    publishedAt: "2026-10-20T09:00:00Z",
    awardedAt: "2026-10-31T10:00:00Z",
    finalStatus: "awarded",
    items: [
      {
        key: "flour-45kg",
        productSku: "FLOUR-45KG",
        productName: "دقيق مخابز فاخر",
        quantity: 25,
        unitLabel: "كيس 45 كجم",
        specificationNotes: "دقيق قمح فاخر مخصص للمخابز والمعجنات.",
      },
    ],
    offers: [
      {
        code: "OFR-2026-0006",
        supplierSlug: "advanced-supply",
        proposedDeliveryDate: "2026-11-04",
        deliveryFee: 120,
        paymentTerms: "الدفع خلال 15 يومًا من الاستلام",
        submittedAt: "2026-10-23T10:00:00Z",
        outcome: "selected",
        items: [
          {
            reqItemKey: "flour-45kg",
            offeredProductName: "دقيق مخابز فاخر - طحين الديرة",
            brandName: "طحين الديرة",
            availableQuantity: 25,
            unitPrice: 160,
          },
        ],
      },
      {
        code: "OFR-2026-0007",
        supplierSlug: "food-resources",
        proposedDeliveryDate: "2026-11-03",
        deliveryFee: 150,
        submittedAt: "2026-10-24T09:00:00Z",
        outcome: "not_selected",
        items: [
          {
            reqItemKey: "flour-45kg",
            offeredProductName: "دقيق مخابز فاخر - مطاحن الوسطى",
            brandName: "مطاحن الوسطى",
            availableQuantity: 25,
            unitPrice: 158,
          },
        ],
      },
    ],
    selectedOfferCode: "OFR-2026-0006",
    purchaseOrder: {
      code: "PO-2026-0001",
      fulfillmentStatus: "confirmed",
      receiptStatus: "pending",
      issuedAt: "2026-10-31T10:30:00Z",
      events: [
        {
          from: null,
          to: "new",
          note: "إنشاء أمر الشراء",
          at: "2026-10-31T10:30:00Z",
          actorEmail: "buyer@safqah.demo",
        },
        {
          from: "new",
          to: "confirmed",
          note: "أكد المورد استلام الطلب وبدء التجهيز.",
          at: "2026-11-01T09:00:00Z",
          actorEmail: "supplier@safqah.demo",
        },
      ],
    },
  },

  /* 5. Order in delivery — fulfillment out_for_delivery with a full timeline. */
  {
    code: "PR-2026-0005",
    buyerSlug: "al-waha",
    createdByEmail: "buyer2@safqah.demo",
    categorySlug: "cleaning",
    title: "توريد منظف أرضيات مركّز",
    notes: "لتغطية احتياج التعقيم الأسبوعي في المقهى.",
    neededByDate: "2026-11-04",
    submissionDeadline: "2026-10-26T15:00:00Z",
    publishedAt: "2026-10-18T09:00:00Z",
    awardedAt: "2026-10-27T10:00:00Z",
    finalStatus: "awarded",
    items: [
      {
        key: "clean-20l",
        productSku: "CLEAN-20L",
        productName: "منظف أرضيات مركّز 20 لتر",
        quantity: 12,
        unitLabel: "عبوة 20 لتر",
      },
    ],
    offers: [
      {
        code: "OFR-2026-0008",
        supplierSlug: "food-resources",
        proposedDeliveryDate: "2026-10-30",
        deliveryFee: 80,
        submittedAt: "2026-10-21T10:00:00Z",
        outcome: "selected",
        items: [
          {
            reqItemKey: "clean-20l",
            offeredProductName: "منظف أرضيات مركّز 20 لتر - نظافة تام",
            brandName: "نظافة تام",
            availableQuantity: 12,
            unitPrice: 95,
          },
        ],
      },
      {
        code: "OFR-2026-0009",
        supplierSlug: "supply-corner",
        proposedDeliveryDate: "2026-10-31",
        deliveryFee: 70,
        submittedAt: "2026-10-22T09:30:00Z",
        outcome: "not_selected",
        items: [
          {
            reqItemKey: "clean-20l",
            offeredProductName: "منظف أرضيات مركّز 20 لتر - بريق",
            brandName: "بريق",
            availableQuantity: 12,
            unitPrice: 98,
          },
        ],
      },
    ],
    selectedOfferCode: "OFR-2026-0008",
    purchaseOrder: {
      code: "PO-2026-0002",
      fulfillmentStatus: "out_for_delivery",
      receiptStatus: "pending",
      issuedAt: "2026-10-27T11:00:00Z",
      events: [
        {
          from: null,
          to: "new",
          note: "إنشاء أمر الشراء",
          at: "2026-10-27T11:00:00Z",
          actorEmail: "buyer2@safqah.demo",
        },
        {
          from: "new",
          to: "confirmed",
          note: "أكد المورد استلام الطلب.",
          at: "2026-10-28T08:00:00Z",
          actorEmail: "supplier2@safqah.demo",
        },
        {
          from: "confirmed",
          to: "preparing",
          note: "جارٍ تجهيز الشحنة في المستودع.",
          at: "2026-11-01T07:00:00Z",
          actorEmail: "supplier2@safqah.demo",
        },
        {
          from: "preparing",
          to: "ready_for_delivery",
          note: "الشحنة جاهزة للتحميل.",
          at: "2026-11-02T18:00:00Z",
          actorEmail: "supplier2@safqah.demo",
        },
        {
          from: "ready_for_delivery",
          to: "out_for_delivery",
          note: "خرجت الشحنة مع المندوب إلى فرع العليا.",
          at: "2026-11-03T06:30:00Z",
          actorEmail: "supplier2@safqah.demo",
        },
      ],
    },
  },

  /* 6. Completed order — delivered, received in full, request closed. */
  {
    code: "PR-2026-0006",
    buyerSlug: "al-nakheel",
    createdByEmail: "buyer@safqah.demo",
    categorySlug: "oils",
    title: "توريد زيت قلي نباتي — الدفعة الشهرية",
    notes: "الدفعة الشهرية المعتادة لزيت القلي.",
    neededByDate: "2026-10-22",
    submissionDeadline: "2026-10-18T15:00:00Z",
    publishedAt: "2026-10-13T09:00:00Z",
    awardedAt: "2026-10-19T10:00:00Z",
    finalStatus: "closed",
    items: [
      {
        key: "oil-17l",
        productSku: "OIL-17L",
        productName: "زيت قلي نباتي 17 لتر",
        quantity: 18,
        unitLabel: "عبوة 17 لتر",
        specificationNotes: "صلاحية لا تقل عن 12 شهرًا عند التسليم.",
      },
    ],
    offers: [
      {
        code: "OFR-2026-0010",
        supplierSlug: "advanced-supply",
        proposedDeliveryDate: "2026-10-21",
        deliveryFee: 110,
        submittedAt: "2026-10-15T10:00:00Z",
        outcome: "selected",
        items: [
          {
            reqItemKey: "oil-17l",
            offeredProductName: "زيت قلي نباتي 17 لتر - نقاء برو",
            brandName: "نقاء برو",
            availableQuantity: 18,
            unitPrice: 116,
          },
        ],
      },
      {
        code: "OFR-2026-0011",
        supplierSlug: "food-resources",
        proposedDeliveryDate: "2026-10-23",
        deliveryFee: 130,
        submittedAt: "2026-10-16T09:00:00Z",
        outcome: "not_selected",
        items: [
          {
            reqItemKey: "oil-17l",
            offeredProductName: "زيت قلي نباتي 17 لتر - زيتنا الذهبي",
            brandName: "زيتنا الذهبي",
            availableQuantity: 18,
            unitPrice: 112,
          },
        ],
      },
    ],
    selectedOfferCode: "OFR-2026-0010",
    purchaseOrder: {
      code: "PO-2026-0003",
      fulfillmentStatus: "delivered",
      receiptStatus: "received_full",
      issuedAt: "2026-10-19T10:30:00Z",
      events: [
        {
          from: null,
          to: "new",
          note: "إنشاء أمر الشراء",
          at: "2026-10-19T10:30:00Z",
          actorEmail: "buyer@safqah.demo",
        },
        {
          from: "new",
          to: "confirmed",
          note: "أكد المورد استلام الطلب.",
          at: "2026-10-19T14:00:00Z",
          actorEmail: "supplier@safqah.demo",
        },
        {
          from: "confirmed",
          to: "preparing",
          note: "جارٍ تجهيز الشحنة.",
          at: "2026-10-20T08:00:00Z",
          actorEmail: "supplier@safqah.demo",
        },
        {
          from: "preparing",
          to: "ready_for_delivery",
          note: "الشحنة جاهزة للتحميل.",
          at: "2026-10-20T17:00:00Z",
          actorEmail: "supplier@safqah.demo",
        },
        {
          from: "ready_for_delivery",
          to: "out_for_delivery",
          note: "خرجت الشحنة مع المندوب.",
          at: "2026-10-21T06:00:00Z",
          actorEmail: "supplier@safqah.demo",
        },
        {
          from: "out_for_delivery",
          to: "delivered",
          note: "تم التسليم واستلام التوقيع من مسؤول الفرع.",
          at: "2026-10-21T09:15:00Z",
          actorEmail: "supplier@safqah.demo",
        },
      ],
      receiptEvent: {
        note: "تأكيد الاستلام بالكامل",
        at: "2026-10-21T10:00:00Z",
        actorEmail: "buyer@safqah.demo",
      },
    },
  },

  /* 7. Free-text product outside the food catalog — commercial furniture. */
  {
    code: "PR-2026-0007",
    buyerSlug: "al-nakheel",
    createdByEmail: "buyer@safqah.demo",
    categorySlug: "furniture",
    title: "تجهيز طاولات جديدة لصالة الفرع الرئيسي",
    notes: "توسعة صالة الطعام تتطلب طاولات إضافية متينة للاستخدام التجاري.",
    neededByDate: "2026-11-28",
    submissionDeadline: "2026-11-20T15:00:00Z",
    publishedAt: "2026-11-03T07:00:00Z",
    finalStatus: "published",
    items: [
      {
        key: "tables",
        // Free text: no catalog product exists for furniture in this MVP.
        productName: "طاولات مطعم خشبية بأربعة مقاعد",
        quantity: 10,
        unitLabel: "طقم",
        specificationNotes: "خشب صلب مقاوم للاستخدام التجاري مع كراسي متناسقة.",
        description: "طقم طاولة مع 4 كراسي مناسب لصالات المطاعم.",
      },
    ],
    offers: [
      {
        code: "OFR-2026-0012",
        supplierSlug: "supply-corner",
        proposedDeliveryDate: "2026-11-13",
        deliveryFee: 300,
        paymentTerms: "دفعة مقدمة 50% والباقي عند التسليم",
        notes: "يشمل التركيب في الموقع.",
        submittedAt: "2026-11-03T12:00:00Z",
        outcome: "open",
        items: [
          {
            reqItemKey: "tables",
            offeredProductName: "طاولات مطعم خشبية فاخرة - طقم 4 مقاعد",
            brandName: "دار الأثاث التجاري",
            specificationNote: "خشب زان صلب مع طلاء مقاوم للخدش.",
            availableQuantity: 10,
            unitPrice: 950,
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Derived amounts (mirrors app/actions/mutations.ts + lib/offer-scoring.ts) */
/* ------------------------------------------------------------------ */

type ComputedOfferItem = OfferItemSeed & { lineTotal: number };

type ComputedOffer = Omit<OfferSeed, "items"> & {
  items: ComputedOfferItem[];
  subtotal: number;
  tax: number;
  total: number;
  deliveryDaysDiff: number;
  meetsDeliveryDate: boolean;
  status: "locked" | "selected" | "not_selected";
  lockedAt: string;
};

function computeOffer(offer: OfferSeed, neededByDate: string): ComputedOffer {
  const items = offer.items.map((item) => ({
    ...item,
    lineTotal: round2(item.unitPrice * item.availableQuantity),
  }));
  const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const taxable = round2(subtotal + offer.deliveryFee);
  const tax = round2(taxable * TAX_RATE);
  const total = round2(taxable + tax);
  const diff = daysBetween(neededByDate, offer.proposedDeliveryDate);
  const meetsDeliveryDate = diff <= 0;
  const deliveryDaysDiff = Math.max(0, diff);
  const status = offer.outcome === "open" ? "locked" : offer.outcome;
  return {
    ...offer,
    items,
    subtotal,
    tax,
    total,
    deliveryDaysDiff,
    meetsDeliveryDate,
    status,
    lockedAt: offer.submittedAt,
  };
}

type OfferScoreRow = {
  offerCode: string;
  priceScore: number;
  deliveryScore: number;
  ratingScore: number;
  totalScore: number;
  isBestValue: boolean;
  isCheapest: boolean;
  isFastest: boolean;
  isHighestRated: boolean;
  explanation: string;
};

/** Mirrors lib/offer-scoring.ts scoreOffers: price 50% + delivery 30% + rating 20%. */
function scoreOffers(offers: ComputedOffer[]): OfferScoreRow[] {
  if (offers.length === 0) return [];

  const amounts = offers.map((o) => o.total);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const amountSpan = maxAmount - minAmount || 1;

  const diffs = offers.map((o) => o.deliveryDaysDiff);
  const minDiff = Math.min(...diffs);
  const maxDiff = Math.max(...diffs);
  const diffSpan = maxDiff - minDiff || 1;

  const ratings = offers.map((o) => RATING_BY_SLUG[o.supplierSlug] ?? 0);
  const maxRating = Math.max(...ratings, 5);

  const scored = offers.map((offer, index) => {
    const rating = ratings[index];
    const priceScore = round2(100 * (1 - (offer.total - minAmount) / amountSpan));
    const deliveryBase = round2(
      100 * (1 - (offer.deliveryDaysDiff - minDiff) / diffSpan),
    );
    const deliveryScoreRaw = offer.meetsDeliveryDate
      ? Math.min(100, deliveryBase + 10)
      : Math.max(0, deliveryBase - 25);
    const deliveryScore = round2(Math.max(0, Math.min(100, deliveryScoreRaw)));
    const ratingScore = round2((rating / maxRating) * 100);
    const totalScore = round2(priceScore * 0.5 + deliveryScore * 0.3 + ratingScore * 0.2);
    return {
      offerCode: offer.code,
      priceScore,
      deliveryScore,
      ratingScore,
      totalScore,
      amount: offer.total,
      diff: offer.deliveryDaysDiff,
      rating,
      meets: offer.meetsDeliveryDate,
      deliveryTs: new Date(offer.proposedDeliveryDate).getTime(),
    };
  });

  const cheapest = scored.reduce((best, cur) => (cur.amount < best.amount ? cur : best));
  const fastest = scored.reduce((best, cur) =>
    cur.deliveryTs < best.deliveryTs || (cur.deliveryTs === best.deliveryTs && cur.diff < best.diff)
      ? cur
      : best,
  );
  const highestRated = scored.reduce((best, cur) => (cur.rating > best.rating ? cur : best));
  const bestValue = scored.reduce((best, cur) => (cur.totalScore > best.totalScore ? cur : best));

  return scored.map((row) => {
    const isBestValue = row.offerCode === bestValue.offerCode;
    const isCheapest = row.offerCode === cheapest.offerCode;
    const isFastest = row.offerCode === fastest.offerCode;
    const isHighestRated = row.offerCode === highestRated.offerCode;
    const priceGap = round2(row.amount - cheapest.amount);
    const parts: string[] = [];
    if (isBestValue) parts.push("أفضل قيمة وفق الوزن المركّب (سعر 50%، توصيل 30%، تقييم 20%)");
    if (isCheapest) parts.push("الأقل سعرًا");
    else if (priceGap > 0) parts.push(`أعلى من الأرخص بـ ${priceGap} ريال`);
    if (isFastest) parts.push("الأسرع توصيلًا");
    if (isHighestRated) parts.push("الأعلى تقييمًا");
    if (row.meets) parts.push("يلتزم بموعد التوصيل المطلوب");
    else parts.push(`يتأخر عن الموعد المطلوب بـ ${row.diff} يوم`);

    return {
      offerCode: row.offerCode,
      priceScore: row.priceScore,
      deliveryScore: row.deliveryScore,
      ratingScore: row.ratingScore,
      totalScore: row.totalScore,
      isBestValue,
      isCheapest,
      isFastest,
      isHighestRated,
      explanation: parts.join(" · "),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Seed                                                                 */
/* ------------------------------------------------------------------ */

async function seed() {
  await applySqlMigrations();

  /* Users, organizations, memberships, profiles ---------------------- */

  await upsert("users", users, [
    ...BUYERS.map((buyer) => ({
      id: seedId(userKey(buyer.email)),
      email: buyer.email,
      passwordHash: PASSWORD_HASH,
      fullName: buyer.contactName,
      phone: buyer.phone,
      role: "buyer" as const,
      isActive: true,
      ...at("2026-10-09T08:00:00Z"),
    })),
    ...SUPPLIERS.map((supplier) => ({
      id: seedId(userKey(supplier.email)),
      email: supplier.email,
      passwordHash: PASSWORD_HASH,
      fullName: supplier.contactName,
      phone: supplier.phone,
      role: "supplier" as const,
      isActive: true,
      ...at("2026-10-09T08:00:00Z"),
    })),
  ]);

  await upsert("organizations", organizations, [
    ...BUYERS.map((buyer) => ({
      id: seedId(buyerOrgKey(buyer.slug)),
      name: buyer.name,
      nameEn: buyer.nameEn,
      type: "buyer" as const,
      commercialRegister: buyer.commercialRegister,
      city: CITY,
      isVerified: true,
      ...at("2026-10-09T08:00:00Z"),
    })),
    ...SUPPLIERS.map((supplier) => ({
      id: seedId(supplierOrgKey(supplier.slug)),
      name: supplier.name,
      nameEn: supplier.nameEn,
      type: "supplier" as const,
      commercialRegister: supplier.commercialRegister,
      city: CITY,
      isVerified: true,
      ...at("2026-10-09T08:00:00Z"),
    })),
  ]);

  await upsert("organizationMembers", organizationMembers, [
    ...BUYERS.map((buyer) => ({
      id: seedId(`member:${buyerOrgKey(buyer.slug)}:${buyer.email}`),
      organizationId: seedId(buyerOrgKey(buyer.slug)),
      userId: seedId(userKey(buyer.email)),
      memberRole: "owner" as const,
      ...at("2026-10-09T08:00:00Z"),
    })),
    ...SUPPLIERS.map((supplier) => ({
      id: seedId(`member:${supplierOrgKey(supplier.slug)}:${supplier.email}`),
      organizationId: seedId(supplierOrgKey(supplier.slug)),
      userId: seedId(userKey(supplier.email)),
      memberRole: "owner" as const,
      ...at("2026-10-09T08:00:00Z"),
    })),
  ]);

  await upsert(
    "buyerProfiles",
    buyerProfiles,
    BUYERS.map((buyer) => ({
      id: seedId(`buyer-profile:${buyer.slug}`),
      organizationId: seedId(buyerOrgKey(buyer.slug)),
      cuisineType: buyer.cuisineType,
      averageMonthlySpend: buyer.monthlySpend,
      ...at("2026-10-09T08:00:00Z"),
    })),
  );

  await upsert(
    "supplierProfiles",
    supplierProfiles,
    SUPPLIERS.map((supplier) => ({
      id: seedId(`supplier-profile:${supplier.slug}`),
      organizationId: seedId(supplierOrgKey(supplier.slug)),
      ratingAverage: supplier.ratingAverage,
      ratingCount: supplier.ratingCount,
      complianceScore: supplier.complianceScore,
      deliveryLeadDays: supplier.deliveryLeadDays,
      serviceCities: DEMO_SERVICE_CITIES,
      about: supplier.about,
      ...at("2026-10-09T08:00:00Z"),
    })),
  );

  /* Branches & delivery addresses -------------------------------------- */

  await upsert(
    "branches",
    branches,
    BUYERS.map((buyer) => ({
      id: seedId(branchKey(buyer.slug)),
      organizationId: seedId(buyerOrgKey(buyer.slug)),
      name: buyer.branchName,
      city: CITY,
      district: buyer.district,
      isPrimary: true,
      ...at("2026-10-09T09:00:00Z"),
    })),
  );

  await upsert(
    "deliveryAddresses",
    deliveryAddresses,
    BUYERS.map((buyer) => ({
      id: seedId(addressKey(buyer.slug)),
      branchId: seedId(branchKey(buyer.slug)),
      label: `عنوان ${buyer.branchName}`,
      street: buyer.street,
      district: buyer.district,
      city: CITY,
      additionalNotes: "الاستلام من باب المستودع الخلفي بين الساعة 8 صباحًا و2 ظهرًا.",
      isDefault: true,
      ...at("2026-10-09T09:00:00Z"),
    })),
  );

  /* Categories, catalog products, supplier categories -------------------- */

  await upsert(
    "categories",
    categories,
    CATEGORY_SEEDS.map((category) => ({
      id: seedId(categoryKey(category.slug)),
      name: category.name,
      slug: category.slug,
      ...at("2026-10-09T07:00:00Z"),
    })),
  );

  await upsert(
    "products",
    products,
    PRODUCT_SEEDS.map((product) => ({
      id: seedId(productKey(product.sku)),
      categoryId: seedId(categoryKey(product.categorySlug)),
      name: product.name,
      sku: product.sku,
      unitLabel: product.unitLabel,
      description: product.description,
      isActive: true,
      ...at("2026-10-09T07:00:00Z"),
    })),
  );

  await upsert(
    "supplierCategories",
    supplierCategories,
    SUPPLIERS.flatMap((supplier) =>
      supplier.categories.map((categorySlug) => ({
        id: seedId(`supplier-category:${supplier.slug}:${categorySlug}`),
        supplierOrganizationId: seedId(supplierOrgKey(supplier.slug)),
        categoryId: seedId(categoryKey(categorySlug)),
        ...at("2026-10-09T08:00:00Z"),
      })),
    ),
  );

  /* Purchase requests, items, offers, purchase orders -------------------- */

  const supplierBySlug = new Map(SUPPLIERS.map((s) => [s.slug, s]));
  const buyerBySlug = new Map(BUYERS.map((b) => [b.slug, b]));

  await upsert(
    "purchaseRequests",
    purchaseRequests,
    PURCHASE_REQUESTS.map((pr) => {
      const buyer = buyerBySlug.get(pr.buyerSlug)!;
      const selectedOffer = pr.selectedOfferCode
        ? seedId(`offer:${pr.selectedOfferCode}`)
        : null;
      return {
        id: seedId(`pr:${pr.code}`),
        code: pr.code,
        organizationId: seedId(buyerOrgKey(buyer.slug)),
        createdByUserId: seedId(userKey(pr.createdByEmail)),
        branchId: seedId(branchKey(buyer.slug)),
        deliveryAddressId: seedId(addressKey(buyer.slug)),
        status: pr.finalStatus,
        title: pr.title,
        notes: pr.notes,
        neededByDate: pr.neededByDate,
        categoryId: seedId(categoryKey(pr.categorySlug)),
        deliveryCity: CITY,
        deliveryDistrict: buyer.district,
        submissionDeadline: new Date(pr.submissionDeadline),
        publishedAt: new Date(pr.publishedAt),
        awardedAt: pr.awardedAt ? new Date(pr.awardedAt) : null,
        selectedOfferId: selectedOffer,
        ...at(pr.publishedAt),
      };
    }),
  );

  await upsert(
    "purchaseRequestItems",
    purchaseRequestItems,
    PURCHASE_REQUESTS.flatMap((pr) =>
      pr.items.map((item, index) => ({
        id: seedId(`pr-item:${pr.code}:${item.key}`),
        purchaseRequestId: seedId(`pr:${pr.code}`),
        productId: item.productSku ? seedId(productKey(item.productSku)) : null,
        productName: item.productName,
        description: item.description ?? null,
        quantity: item.quantity,
        unitLabel: item.unitLabel,
        specificationNotes: item.specificationNotes ?? null,
        sortOrder: index,
        ...at(pr.publishedAt),
      })),
    ),
  );

  await upsert(
    "purchaseRequestStatusHistory",
    purchaseRequestStatusHistory,
    PURCHASE_REQUESTS.flatMap((pr) => {
      const history = [
        {
          id: seedId(`pr-history:${pr.code}:published`),
          purchaseRequestId: seedId(`pr:${pr.code}`),
          fromStatus: null,
          toStatus: "published" as const,
          changedByUserId: seedId(userKey(pr.createdByEmail)),
          note: "نشر طلب شراء لاستقبال عروض الموردين",
          createdAt: new Date(pr.publishedAt),
        },
      ];
      if (pr.awardedAt) {
        const winningSupplierName = pr.selectedOfferCode
          ? supplierBySlug.get(
              pr.offers.find((o) => o.code === pr.selectedOfferCode)!.supplierSlug,
            )!.name
          : "";
        history.push({
          id: seedId(`pr-history:${pr.code}:awarded`),
          purchaseRequestId: seedId(`pr:${pr.code}`),
          fromStatus: "published" as const,
          toStatus: "awarded" as const,
          changedByUserId: seedId(userKey(pr.createdByEmail)),
          note: `اختيار عرض ${winningSupplierName} وإنشاء أمر شراء`,
          createdAt: new Date(pr.awardedAt),
        } as never);
      }
      return history;
    }),
  );

  // Pre-compute every offer's amounts once so downstream tables stay consistent.
  const computedByRequest = new Map<string, ComputedOffer[]>();
  for (const pr of PURCHASE_REQUESTS) {
    computedByRequest.set(
      pr.code,
      pr.offers.map((offer) => computeOffer(offer, pr.neededByDate)),
    );
  }

  await upsert(
    "offers",
    offers,
    PURCHASE_REQUESTS.flatMap((pr) => {
      const computed = computedByRequest.get(pr.code)!;
      return computed.map((offer) => {
        const supplier = supplierBySlug.get(offer.supplierSlug)!;
        const lockedAt =
          offer.status === "selected" && pr.awardedAt ? pr.awardedAt : offer.lockedAt;
        return {
          id: seedId(`offer:${offer.code}`),
          code: offer.code,
          purchaseRequestId: seedId(`pr:${pr.code}`),
          supplierOrganizationId: seedId(supplierOrgKey(supplier.slug)),
          submittedByUserId: seedId(userKey(supplier.email)),
          status: offer.status,
          deliveryFee: money(offer.deliveryFee),
          paymentTerms: offer.paymentTerms ?? null,
          notes: offer.notes ?? null,
          proposedDeliveryDate: offer.proposedDeliveryDate,
          meetsDeliveryDate: offer.meetsDeliveryDate,
          deliveryDaysDiff: offer.deliveryDaysDiff,
          subtotalAmount: money(offer.subtotal),
          taxAmount: money(offer.tax),
          totalAmount: money(offer.total),
          isLocked: true,
          submittedAt: new Date(offer.submittedAt),
          lockedAt: new Date(lockedAt),
          ...at(offer.submittedAt),
        };
      });
    }),
  );

  await upsert(
    "offerItems",
    offerItems,
    PURCHASE_REQUESTS.flatMap((pr) => {
      const computed = computedByRequest.get(pr.code)!;
      return computed.flatMap((offer) =>
        offer.items.map((item) => ({
          id: seedId(`offer-item:${offer.code}:${item.reqItemKey}`),
          offerId: seedId(`offer:${offer.code}`),
          purchaseRequestItemId: seedId(`pr-item:${pr.code}:${item.reqItemKey}`),
          offeredProductName: item.offeredProductName,
          brandName: item.brandName ?? null,
          specificationNote: item.specificationNote ?? null,
          availableQuantity: item.availableQuantity,
          unitPrice: money(item.unitPrice),
          lineTotal: money(item.lineTotal),
          isAlternative: false,
          ...at(offer.submittedAt),
        })),
      );
    }),
  );

  await upsert(
    "offerScores",
    offerScores,
    PURCHASE_REQUESTS.filter((pr) => pr.computeScores).flatMap((pr) => {
      const computed = computedByRequest.get(pr.code)!;
      const scores = scoreOffers(computed);
      return scores.map((score) => ({
        id: seedId(`offer-score:${score.offerCode}`),
        offerId: seedId(`offer:${score.offerCode}`),
        priceScore: money(score.priceScore),
        deliveryScore: money(score.deliveryScore),
        ratingScore: money(score.ratingScore),
        totalScore: money(score.totalScore),
        isBestValue: score.isBestValue,
        isCheapest: score.isCheapest,
        isFastest: score.isFastest,
        isHighestRated: score.isHighestRated,
        explanation: score.explanation,
        ...at(pr.submissionDeadline),
      }));
    }),
  );

  const withPo = PURCHASE_REQUESTS.filter(
    (pr): pr is PurchaseRequestSeed & { purchaseOrder: PurchaseOrderSeed } =>
      pr.purchaseOrder !== undefined,
  );

  await upsert(
    "purchaseOrders",
    purchaseOrders,
    withPo.map((pr) => {
      const buyer = buyerBySlug.get(pr.buyerSlug)!;
      const winningOffer = computedByRequest
        .get(pr.code)!
        .find((offer) => offer.code === pr.selectedOfferCode)!;
      const supplier = supplierBySlug.get(winningOffer.supplierSlug)!;
      return {
        id: seedId(`po:${pr.purchaseOrder.code}`),
        code: pr.purchaseOrder.code,
        offerId: seedId(`offer:${winningOffer.code}`),
        purchaseRequestId: seedId(`pr:${pr.code}`),
        buyerOrganizationId: seedId(buyerOrgKey(buyer.slug)),
        supplierOrganizationId: seedId(supplierOrgKey(supplier.slug)),
        status:
          pr.purchaseOrder.fulfillmentStatus === "new"
            ? ("issued" as const)
            : pr.purchaseOrder.fulfillmentStatus === "confirmed"
              ? ("confirmed" as const)
              : pr.purchaseOrder.fulfillmentStatus === "delivered"
                ? ("delivered" as const)
                : ("in_fulfillment" as const),
        fulfillmentStatus: pr.purchaseOrder.fulfillmentStatus,
        receiptStatus: pr.purchaseOrder.receiptStatus,
        totalAmount: money(winningOffer.total),
        deliveryFee: money(winningOffer.deliveryFee),
        paymentTerms: winningOffer.paymentTerms ?? null,
        expectedDeliveryDate: winningOffer.proposedDeliveryDate,
        issuedAt: new Date(pr.purchaseOrder.issuedAt),
        ...at(pr.purchaseOrder.issuedAt),
      };
    }),
  );

  await upsert(
    "purchaseOrderItems",
    purchaseOrderItems,
    withPo.flatMap((pr) => {
      const winningOffer = computedByRequest
        .get(pr.code)!
        .find((offer) => offer.code === pr.selectedOfferCode)!;
      return winningOffer.items.map((item) => ({
        id: seedId(`po-item:${pr.purchaseOrder.code}:${item.reqItemKey}`),
        purchaseOrderId: seedId(`po:${pr.purchaseOrder.code}`),
        productId: null,
        productName: item.offeredProductName,
        quantity: item.availableQuantity,
        unitPrice: money(item.unitPrice),
        lineTotal: money(item.lineTotal),
        specificationNote: item.specificationNote ?? null,
        ...at(pr.purchaseOrder.issuedAt),
      }));
    }),
  );

  await upsert(
    "fulfillmentEvents",
    fulfillmentEvents,
    withPo.flatMap((pr) => {
      const events = pr.purchaseOrder.events.map((event, index) => ({
        id: seedId(`fulfillment-event:${pr.purchaseOrder.code}:${index}`),
        purchaseOrderId: seedId(`po:${pr.purchaseOrder.code}`),
        fromStatus: event.from,
        toStatus: event.to,
        changedByUserId: seedId(userKey(event.actorEmail)),
        note: event.note,
        createdAt: new Date(event.at),
      }));
      if (pr.purchaseOrder.receiptEvent) {
        const lastStatus = pr.purchaseOrder.fulfillmentStatus;
        events.push({
          id: seedId(`fulfillment-event:${pr.purchaseOrder.code}:receipt`),
          purchaseOrderId: seedId(`po:${pr.purchaseOrder.code}`),
          fromStatus: lastStatus,
          toStatus: lastStatus,
          changedByUserId: seedId(userKey(pr.purchaseOrder.receiptEvent.actorEmail)),
          note: pr.purchaseOrder.receiptEvent.note,
          createdAt: new Date(pr.purchaseOrder.receiptEvent.at),
        });
      }
      return events;
    }),
  );

  /* Notifications & audit log — mirror app/actions/mutations.ts wording ---- */

  type NotificationSeed = {
    key: string;
    email: string;
    title: string;
    body: string;
    linkPath: string;
    isRead: boolean;
    at: string;
  };

  type AuditSeed = {
    key: string;
    actorEmail: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    details: string;
    at: string;
  };

  const notificationSeeds: NotificationSeed[] = [];
  const auditSeeds: AuditSeed[] = [];

  for (const pr of PURCHASE_REQUESTS) {
    const prId = seedId(`pr:${pr.code}`);

    // Publish: buyer confirmation + matching-supplier opportunity notices.
    notificationSeeds.push({
      key: `${pr.code}:published`,
      email: pr.createdByEmail,
      title: "تم نشر طلب الشراء",
      body: `نُشر الطلب ${pr.code} وأصبح ظاهرًا للموردين المناسبين.`,
      linkPath: `/buyer/requests/${prId}`,
      isRead: true,
      at: pr.publishedAt,
    });
    auditSeeds.push({
      key: `${pr.code}:publish`,
      actorEmail: pr.createdByEmail,
      action: "purchase_request.publish",
      entityType: "purchase_request",
      entityId: prId,
      details: pr.code,
      at: pr.publishedAt,
    });

    const matchedSuppliers = SUPPLIERS.filter((s) => s.categories.includes(pr.categorySlug));
    matchedSuppliers.forEach((supplier, index) => {
      notificationSeeds.push({
        key: `${pr.code}:opportunity:${supplier.slug}`,
        email: supplier.email,
        title: "فرصة توريد جديدة",
        body: `فرصة مطابقة: ${pr.title}`,
        linkPath: `/supplier/opportunities/${prId}`,
        isRead: index < matchedSuppliers.length - 1,
        at: pr.publishedAt,
      });
    });

    // Offers: buyer is notified of every submission.
    const computed = computedByRequest.get(pr.code)!;
    for (const offer of computed) {
      const offerId = seedId(`offer:${offer.code}`);
      notificationSeeds.push({
        key: `${offer.code}:submitted`,
        email: pr.createdByEmail,
        title: "عرض جديد على طلبك",
        body: `ورد عرض جديد على الطلب ${pr.code}.`,
        linkPath: `/buyer/requests/${prId}/offers`,
        isRead: pr.finalStatus !== "published" || offer.status !== "locked",
        at: offer.submittedAt,
      });
      auditSeeds.push({
        key: `${offer.code}:submit`,
        actorEmail: supplierBySlug.get(offer.supplierSlug)!.email,
        action: "offer.submit",
        entityType: "offer",
        entityId: offerId,
        details: prId,
        at: offer.submittedAt,
      });
    }

    // Award + purchase order.
    if (pr.selectedOfferCode && pr.awardedAt) {
      const winningOffer = computed.find((o) => o.code === pr.selectedOfferCode)!;
      const winningSupplier = supplierBySlug.get(winningOffer.supplierSlug)!;
      const offerId = seedId(`offer:${winningOffer.code}`);
      auditSeeds.push({
        key: `${winningOffer.code}:select`,
        actorEmail: pr.createdByEmail,
        action: "offer.select",
        entityType: "offer",
        entityId: offerId,
        details: pr.purchaseOrder?.code ?? "",
        at: pr.awardedAt,
      });

      if (pr.purchaseOrder) {
        const poId = seedId(`po:${pr.purchaseOrder.code}`);
        notificationSeeds.push({
          key: `${pr.purchaseOrder.code}:selected`,
          email: winningSupplier.email,
          title: "تم اختيار عرضك",
          body: `تم اختيار عرضك للطلب ${pr.code}. صدر أمر توريد ${pr.purchaseOrder.code}.`,
          linkPath: `/supplier/purchase-orders/${poId}`,
          isRead: true,
          at: pr.awardedAt,
        });
        notificationSeeds.push({
          key: `${pr.purchaseOrder.code}:po_created`,
          email: pr.createdByEmail,
          title: "تم إنشاء أمر الشراء",
          body: `أُنشئ أمر الشراء ${pr.purchaseOrder.code} من العرض المختار.`,
          linkPath: `/buyer/purchase-orders/${poId}`,
          isRead: true,
          at: pr.awardedAt,
        });

        // Fulfillment transitions after the initial "new" event mirror
        // real updateFulfillmentStatus() calls (audit + buyer notification each).
        pr.purchaseOrder.events.slice(1).forEach((event) => {
          auditSeeds.push({
            key: `${pr.purchaseOrder!.code}:fulfillment:${event.to}`,
            actorEmail: event.actorEmail,
            action: "fulfillment.update",
            entityType: "purchase_order",
            entityId: poId,
            details: `${event.from}->${event.to}`,
            at: event.at,
          });
          notificationSeeds.push({
            key: `${pr.purchaseOrder!.code}:fulfillment:${event.to}`,
            email: pr.createdByEmail,
            title: "تحديث حالة التوريد",
            body: `تم تحديث أمر ${pr.purchaseOrder!.code} إلى حالة جديدة.`,
            linkPath: `/buyer/purchase-orders/${poId}`,
            isRead: event.to !== pr.purchaseOrder!.fulfillmentStatus,
            at: event.at,
          });
        });

        if (pr.purchaseOrder.receiptEvent) {
          auditSeeds.push({
            key: `${pr.purchaseOrder.code}:receipt`,
            actorEmail: pr.purchaseOrder.receiptEvent.actorEmail,
            action: "receipt.confirm",
            entityType: "purchase_order",
            entityId: poId,
            details: pr.purchaseOrder.receiptStatus,
            at: pr.purchaseOrder.receiptEvent.at,
          });
          notificationSeeds.push({
            key: `${pr.purchaseOrder.code}:receipt`,
            email: winningSupplier.email,
            title: "تأكيد استلام من المشتري",
            body: `أكد المشتري استلام أمر ${pr.purchaseOrder.code}.`,
            linkPath: `/supplier/purchase-orders/${poId}`,
            isRead: false,
            at: pr.purchaseOrder.receiptEvent.at,
          });
        }
      }
    }
  }

  await upsert(
    "notifications",
    notifications,
    notificationSeeds.map((notification) => ({
      id: seedId(`notification:${notification.key}`),
      userId: seedId(userKey(notification.email)),
      title: notification.title,
      body: notification.body,
      linkPath: notification.linkPath,
      isRead: notification.isRead,
      createdAt: new Date(notification.at),
    })),
  );

  await upsert(
    "auditLogs",
    auditLogs,
    auditSeeds.map((entry) => ({
      id: seedId(`audit:${entry.key}`),
      actorUserId: entry.actorEmail ? seedId(userKey(entry.actorEmail)) : null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details,
      createdAt: new Date(entry.at),
    })),
  );
}

seed()
  .then(async () => {
    const summary = Object.entries(counts)
      .map(([label, value]) => `  • ${label}: ${value}`)
      .join("\n");
    console.log("✔ تم تنفيذ البذور بنجاح (Safqah seed completed).");
    console.log(summary);
    console.log("");
    console.log(`Demo accounts (password ${DEMO_PASSWORD}):`);
    console.log("  buyer@safqah.demo");
    console.log("  buyer2@safqah.demo");
    console.log("  supplier@safqah.demo");
    console.log("  supplier2@safqah.demo");
    console.log("  supplier3@safqah.demo");
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("✖ فشل تنفيذ البذور (Safqah seed failed).");
    console.error(error);
    await closeDb();
    process.exit(1);
  });
