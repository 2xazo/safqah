"use client";

import { useMemo, useState, useTransition } from "react";
import { submitOffer } from "@/app/actions/mutations";
import { daysBetweenDates } from "@/lib/workflow";

export type OfferFormRequestItem = {
  id: string;
  productName: string;
  quantity: number;
  unitLabel: string;
  specificationNotes: string | null;
  brandPreference: string | null;
  acceptedAlternatives: string | null;
};

export type OfferFormExistingLine = {
  purchaseRequestItemId: string | null;
  offeredProductName: string;
  brandName: string | null;
  specificationNote: string | null;
  availableQuantity: number;
  unitPrice: string;
  isAlternative: boolean;
};

export type OfferFormExisting = {
  offerValidityDate: string | null;
  deliveryFee: string;
  paymentTerms: string | null;
  notes: string | null;
  proposedDeliveryDate: string;
  lines: OfferFormExistingLine[];
};

type LineState = {
  itemId: string;
  offeredProductName: string;
  brandName: string;
  specificationNote: string;
  availableQuantity: string;
  unitPrice: string;
  isAlternative: boolean;
};

function defaultProposedDate(neededByDate: string | null) {
  if (neededByDate) return neededByDate;
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function buildInitialLines(
  items: OfferFormRequestItem[],
  existing?: OfferFormExisting | null,
): LineState[] {
  return items.map((item) => {
    const match = existing?.lines.find((l) => l.purchaseRequestItemId === item.id);
    return {
      itemId: item.id,
      offeredProductName: match?.offeredProductName ?? item.productName,
      brandName: match?.brandName ?? item.brandPreference ?? "",
      specificationNote: match?.specificationNote ?? item.specificationNotes ?? "",
      availableQuantity: String(match?.availableQuantity ?? item.quantity),
      unitPrice: match?.unitPrice ?? "",
      isAlternative: match?.isAlternative ?? false,
    };
  });
}

export function OfferForm({
  purchaseRequestId,
  items,
  neededByDate,
  existing,
}: {
  purchaseRequestId: string;
  items: OfferFormRequestItem[];
  neededByDate: string | null;
  existing?: OfferFormExisting | null;
}) {
  const [proposedDeliveryDate, setProposedDeliveryDate] = useState(
    existing?.proposedDeliveryDate ?? defaultProposedDate(neededByDate),
  );
  const [offerValidityDate, setOfferValidityDate] = useState(existing?.offerValidityDate ?? "");
  const [deliveryFee, setDeliveryFee] = useState(existing?.deliveryFee ?? "0");
  const [paymentTerms, setPaymentTerms] = useState(existing?.paymentTerms ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [lines, setLines] = useState<LineState[]>(buildInitialLines(items, existing));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const dayDiff = useMemo(() => {
    if (!neededByDate || !proposedDeliveryDate) return null;
    return daysBetweenDates(neededByDate, proposedDeliveryDate);
  }, [neededByDate, proposedDeliveryDate]);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.availableQuantity) || 0;
        const price = Number(line.unitPrice) || 0;
        return sum + qty * price;
      }, 0),
    [lines],
  );
  const fee = Number(deliveryFee) || 0;
  const tax = Math.round((subtotal + fee) * 0.15 * 100) / 100;
  const total = Math.round((subtotal + fee + tax) * 100) / 100;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const cleanedLines = lines.map((line) => ({
      purchaseRequestItemId: line.itemId,
      offeredProductName: line.offeredProductName.trim(),
      brandName: line.brandName.trim() || undefined,
      specificationNote: line.specificationNote.trim() || undefined,
      availableQuantity: Number(line.availableQuantity),
      unitPrice: Number(line.unitPrice),
      isAlternative: line.isAlternative,
    }));

    if (
      cleanedLines.some(
        (l) =>
          !l.offeredProductName ||
          !Number.isFinite(l.availableQuantity) ||
          l.availableQuantity <= 0 ||
          !Number.isFinite(l.unitPrice) ||
          l.unitPrice <= 0,
      )
    ) {
      setError("أكمل الكمية والسعر لكل بند قبل التقديم.");
      return;
    }
    if (!proposedDeliveryDate) {
      setError("حدد تاريخ التسليم المقترح.");
      return;
    }

    const fd = new FormData();
    fd.set("purchaseRequestId", purchaseRequestId);
    fd.set("proposedDeliveryDate", proposedDeliveryDate);
    fd.set("offerValidityDate", offerValidityDate);
    fd.set("deliveryFee", String(fee));
    fd.set("paymentTerms", paymentTerms.trim());
    fd.set("notes", notes.trim());
    fd.set("lock", "true");
    fd.set("itemsJson", JSON.stringify(cleanedLines));

    startTransition(async () => {
      try {
        await submitOffer(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر تقديم العرض");
      }
    });
  }

  return (
    <form className="panel bid-form" onSubmit={onSubmit}>
      <h3>تفاصيل عرضك</h3>
      <p className="warning" style={{ marginTop: 0 }}>
        العرض يُقدَّم لكامل بنود الطلب دفعة واحدة، ويُقفل فور التقديم ولا يمكن تعديله.
      </p>

      <div className="fields">
        <label>
          تاريخ التسليم المقترح
          <input
            type="date"
            required
            value={proposedDeliveryDate}
            onChange={(e) => setProposedDeliveryDate(e.target.value)}
          />
        </label>
        <label>
          صلاحية العرض حتى
          <input
            type="date"
            value={offerValidityDate}
            onChange={(e) => setOfferValidityDate(e.target.value)}
          />
        </label>
        <label>
          رسوم التوصيل (ر.س)
          <input
            type="number"
            min={0}
            step="0.01"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
          />
        </label>
        <label>
          شروط الدفع
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="مثال: تحويل بنكي خلال 15 يومًا من الاستلام"
          />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          ملاحظات إضافية
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      {neededByDate ? (
        <div className={dayDiff !== null && dayDiff > 0 ? "warning" : "delivery-mini"}>
          {dayDiff === null ? null : dayDiff > 0 ? (
            <span>
              تنبيه: التسليم المقترح يتأخر عن الموعد المطلوب ({neededByDate}) بمقدار {dayDiff}{" "}
              يوم.
            </span>
          ) : (
            <>
              <span>✓</span>
              <div>
                <strong>يلتزم العرض بموعد الحاجة المطلوب</strong>
                <small>الموعد المطلوب: {neededByDate}</small>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <div className="panel-title">
          <h3>بنود العرض</h3>
        </div>
        {items.map((item, index) => {
          const line = lines[index];
          return (
            <div key={item.id} className="panel" style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 8px" }}>
                الطلب: <strong>{item.productName}</strong> — {item.quantity} × {item.unitLabel}
                {item.specificationNotes ? ` · ${item.specificationNotes}` : ""}
              </p>
              <div className="fields">
                <label style={{ gridColumn: "1 / -1" }}>
                  المنتج/البند المعروض
                  <input
                    required
                    value={line.offeredProductName}
                    onChange={(e) => updateLine(index, { offeredProductName: e.target.value })}
                  />
                </label>
                <label>
                  الكمية المتاحة
                  <input
                    type="number"
                    min={1}
                    required
                    value={line.availableQuantity}
                    onChange={(e) => updateLine(index, { availableQuantity: e.target.value })}
                  />
                </label>
                <label>
                  سعر الوحدة (ر.س)
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                  />
                </label>
                <label>
                  العلامة التجارية
                  <input
                    value={line.brandName}
                    onChange={(e) => updateLine(index, { brandName: e.target.value })}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  ملاحظة مواصفات
                  <input
                    value={line.specificationNote}
                    onChange={(e) => updateLine(index, { specificationNote: e.target.value })}
                  />
                </label>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={line.isAlternative}
                  onChange={(e) => updateLine(index, { isAlternative: e.target.checked })}
                />
                هذا بديل مقترح وليس المطابقة الحرفية للطلب
              </label>
            </div>
          );
        })}
      </div>

      <div className="price-summary" style={{ marginTop: 18 }}>
        <span>
          المجموع الفرعي <b>{subtotal.toFixed(2)} ر.س</b>
        </span>
        <span>
          رسوم التوصيل <b>{fee.toFixed(2)} ر.س</b>
        </span>
        <span>
          الضريبة (15%) <b>{tax.toFixed(2)} ر.س</b>
        </span>
        <span className="total">
          الإجمالي <b>{total.toFixed(2)} ر.س</b>
        </span>
      </div>

      {error ? <div className="warning">{error}</div> : null}

      <div className="panel-actions" style={{ marginTop: 16 }}>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "جارٍ التقديم..." : "تقديم العرض نهائيًا"}
        </button>
      </div>
    </form>
  );
}
