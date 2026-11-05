export type StatusTone = "blue" | "gold" | "green" | "purple" | "red" | "gray";

export type StatusEntry = { label: string; tone: StatusTone };

export type StatusKind =
  | "purchaseRequest"
  | "groupDeal"
  | "competition"
  | "invitation"
  | "bid"
  | "offer"
  | "award"
  | "finalOffer"
  | "purchaseOrder"
  | "fulfillment"
  | "receipt"
  | "delivery"
  | "complaint";

const purchaseRequest: Record<string, StatusEntry> = {
  draft: { label: "مسودة", tone: "gray" },
  submitted: { label: "مُرسل", tone: "blue" },
  under_review: { label: "قيد المراجعة", tone: "gold" },
  aggregated: { label: "مضموم إلى صفقة", tone: "green" },
  rejected: { label: "مرفوض", tone: "red" },
  cancelled: { label: "ملغى", tone: "gray" },
  published: { label: "منشور لاستقبال العروض", tone: "gold" },
  awarded: { label: "تم اختيار المورد", tone: "green" },
  closed: { label: "مغلق", tone: "gray" },
};

const groupDeal: Record<string, StatusEntry> = {
  forming: { label: "قيد التكوين", tone: "gold" },
  ready: { label: "جاهزة للطرح", tone: "blue" },
  in_competition: { label: "ضمن منافسة", tone: "purple" },
  awarded: { label: "مُرسّاة", tone: "green" },
  closed: { label: "مغلقة", tone: "gray" },
  cancelled: { label: "ملغاة", tone: "gray" },
};

const competition: Record<string, StatusEntry> = {
  draft: { label: "مسودة", tone: "gray" },
  inviting: { label: "دعوة الموردين", tone: "blue" },
  open: { label: "استقبال العروض", tone: "gold" },
  closed: { label: "أُغلق التقديم", tone: "purple" },
  revealed: { label: "تم فتح العروض", tone: "purple" },
  awarded: { label: "تمت الترسية", tone: "green" },
  cancelled: { label: "ملغاة", tone: "gray" },
};

const invitation: Record<string, StatusEntry> = {
  pending: { label: "بانتظار الرد", tone: "gold" },
  accepted: { label: "مقبولة", tone: "green" },
  declined: { label: "معتذر عنها", tone: "red" },
  expired: { label: "منتهية المدة", tone: "gray" },
};

const bid: Record<string, StatusEntry> = {
  draft: { label: "مسودة", tone: "gray" },
  submitted: { label: "مُقدَّم", tone: "green" },
  locked: { label: "مقفل", tone: "purple" },
  withdrawn: { label: "مسحوب", tone: "red" },
};

const offer: Record<string, StatusEntry> = {
  draft: { label: "مسودة", tone: "gray" },
  submitted: { label: "مقدم", tone: "green" },
  locked: { label: "مقفل", tone: "purple" },
  selected: { label: "تم اختيارك", tone: "green" },
  not_selected: { label: "لم يتم اختيارك", tone: "red" },
  withdrawn: { label: "منتهي", tone: "gray" },
};

const award: Record<string, StatusEntry> = {
  pending: { label: "بانتظار الاعتماد", tone: "gold" },
  approved: { label: "معتمد", tone: "green" },
  rejected: { label: "مرفوض", tone: "red" },
};

const finalOffer: Record<string, StatusEntry> = {
  pending: { label: "بانتظار موافقتك", tone: "gold" },
  accepted: { label: "مقبول", tone: "green" },
  rejected: { label: "مرفوض", tone: "red" },
  expired: { label: "منتهي الصلاحية", tone: "gray" },
};

const purchaseOrder: Record<string, StatusEntry> = {
  issued: { label: "صادر", tone: "blue" },
  confirmed: { label: "مؤكد", tone: "purple" },
  in_fulfillment: { label: "قيد التنفيذ", tone: "gold" },
  delivered: { label: "تم التسليم", tone: "green" },
  cancelled: { label: "ملغى", tone: "gray" },
};

const fulfillment: Record<string, StatusEntry> = {
  new: { label: "جديد", tone: "blue" },
  confirmed: { label: "مؤكد", tone: "purple" },
  preparing: { label: "قيد التجهيز", tone: "gold" },
  ready_for_delivery: { label: "جاهز للتسليم", tone: "purple" },
  out_for_delivery: { label: "خرج للتوصيل", tone: "gold" },
  delivered: { label: "تم التسليم", tone: "green" },
};

const receipt: Record<string, StatusEntry> = {
  pending: { label: "بانتظار تأكيد الاستلام", tone: "gold" },
  received_full: { label: "تم الاستلام بالكامل", tone: "green" },
  received_with_issue: { label: "تم الاستلام مع ملاحظة", tone: "red" },
};

const delivery: Record<string, StatusEntry> = {
  preparing: { label: "قيد التجهيز", tone: "gold" },
  scheduled: { label: "تمت جدولة التوصيل", tone: "blue" },
  out_for_delivery: { label: "خرج للتوصيل", tone: "purple" },
  delivered: { label: "تم التسليم", tone: "green" },
  failed: { label: "تعذّر التسليم", tone: "red" },
  new: { label: "جديد", tone: "blue" },
  confirmed: { label: "مؤكد", tone: "purple" },
  ready_for_delivery: { label: "جاهز للتسليم", tone: "purple" },
};

const complaint: Record<string, StatusEntry> = {
  open: { label: "مفتوح", tone: "gold" },
  in_review: { label: "قيد المعالجة", tone: "blue" },
  resolved: { label: "تمت المعالجة", tone: "green" },
  rejected: { label: "مرفوض", tone: "red" },
};

export const STATUS_LABELS: Record<StatusKind, Record<string, StatusEntry>> = {
  purchaseRequest,
  groupDeal,
  competition,
  invitation,
  bid,
  offer,
  award,
  finalOffer,
  purchaseOrder,
  fulfillment,
  receipt,
  delivery,
  complaint,
};

const FALLBACK: StatusEntry = { label: "غير محدد", tone: "gray" };

export function statusEntry(kind: StatusKind, value: string | null | undefined): StatusEntry {
  if (!value) return FALLBACK;
  return STATUS_LABELS[kind][value] ?? FALLBACK;
}

export function statusLabel(kind: StatusKind, value: string | null | undefined): string {
  return statusEntry(kind, value).label;
}

export function statusTone(kind: StatusKind, value: string | null | undefined): StatusTone {
  return statusEntry(kind, value).tone;
}

/** Buyer-facing request status when the offer window has ended without award. */
export function buyerRequestDisplayStatus(
  status: string,
  submissionDeadline: string | Date | null | undefined,
): StatusEntry {
  if (status === "published" && submissionDeadline) {
    const passed = new Date(submissionDeadline).getTime() < Date.now();
    if (passed) {
      return { label: "انتهى استقبال العروض", tone: "purple" };
    }
  }
  return statusEntry("purchaseRequest", status);
}

export const ROLE_LABELS: Record<"buyer" | "supplier" | "admin", string> = {
  buyer: "حساب مشتري",
  supplier: "حساب مورد",
  admin: "حساب مسؤول",
};

export const ORG_TYPE_LABELS: Record<"buyer" | "supplier" | "admin", string> = {
  buyer: "منشأة مشترية",
  supplier: "منشأة موردة",
  admin: "إدارة المنصة",
};

export const MEMBER_ROLE_LABELS: Record<"owner" | "admin" | "member", string> = {
  owner: "مالك الحساب",
  admin: "مسؤول",
  member: "عضو",
};

export const EVALUATION_WEIGHTS = [
  { key: "price", label: "السعر", weight: 50 },
  { key: "delivery", label: "التوصيل", weight: 30 },
  { key: "rating", label: "تقييم المورد", weight: 20 },
] as const;

export const FULFILLMENT_FLOW = [
  "new",
  "confirmed",
  "preparing",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
] as const;
