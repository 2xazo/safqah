import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { offers, purchaseRequestItems } from "@/db/schema";
import { Badge, PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime, formatQuantity } from "@/lib/format";
import { opportunityState, OPPORTUNITY_STATE_LABEL } from "@/lib/workflow";
import { listPublishedOpportunitiesForSupplier } from "@/lib/matching";

export default async function SupplierOpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const opportunities = await listPublishedOpportunitiesForSupplier(session.organizationId);
  const opportunity = opportunities.find((o) => o.id === id);
  if (!opportunity) notFound();

  const items = await db
    .select()
    .from(purchaseRequestItems)
    .where(eq(purchaseRequestItems.purchaseRequestId, id))
    .orderBy(purchaseRequestItems.sortOrder);

  const [existingOffer] = await db
    .select({ id: offers.id, status: offers.status })
    .from(offers)
    .where(
      and(eq(offers.purchaseRequestId, id), eq(offers.supplierOrganizationId, session.organizationId)),
    )
    .limit(1);

  const state = opportunityState({
    requestStatus: opportunity.status,
    submissionDeadline: opportunity.submissionDeadline,
    hasOffer: Boolean(existingOffer),
    isWinner: existingOffer?.status === "selected",
  });
  const canOffer = state === "available";

  return (
    <div className="opportunity-detail">
      <Link className="back-link" href="/supplier/opportunities">
        العودة إلى فرص التوريد
      </Link>

      <PageHeader
        title={opportunity.title}
        description={`${opportunity.code} · ${
          opportunity.matchReason === "category_and_city" ? "مطابقة لتصنيفك" : "فرص أخرى"
        }`}
        actions={<Badge tone="blue">{OPPORTUNITY_STATE_LABEL[state]}</Badge>}
      />

      <div className="offer-layout">
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>معلومات الطلب</h3>
          <div className="fields" style={{ marginTop: 8 }}>
            <div>
              <small className="helper-text">مدينة / منطقة التوصيل</small>
              <strong>
                {opportunity.deliveryCity}
                {opportunity.deliveryDistrict ? ` — ${opportunity.deliveryDistrict}` : ""}
              </strong>
            </div>
            <div>
              <small className="helper-text">تاريخ التوصيل المطلوب</small>
              <strong>{formatDate(opportunity.neededByDate)}</strong>
            </div>
            <div>
              <small className="helper-text">آخر موعد للعروض</small>
              <strong>{formatDateTime(opportunity.submissionDeadline)}</strong>
            </div>
            <div>
              <small className="helper-text">عدد البنود</small>
              <strong>{items.length}</strong>
            </div>
          </div>
          {opportunity.notes ? (
            <p style={{ fontSize: 14, marginTop: 14 }}>
              <strong>ملاحظات عامة: </strong>
              {opportunity.notes}
            </p>
          ) : null}

          <h3 style={{ marginTop: 24 }}>بنود الطلب</h3>
          {items.length === 0 ? (
            <p className="warning">لا توجد بنود صالحة لهذا الطلب.</p>
          ) : (
            items.map((item, index) => (
              <div className="line-item-card" key={item.id}>
                <div className="line-item-card__head">
                  <strong>
                    البند {index + 1}: {item.productName}
                  </strong>
                  <span>{formatQuantity(item.quantity, item.unitLabel)}</span>
                </div>
                {item.specificationNotes || item.description ? (
                  <p style={{ margin: "6px 0", fontSize: 13.5 }}>
                    <strong>المواصفات: </strong>
                    {item.specificationNotes || item.description}
                  </p>
                ) : null}
                {item.brandPreference ? (
                  <p style={{ margin: "4px 0", fontSize: 13.5 }}>
                    <strong>تفضيل العلامة: </strong>
                    {item.brandPreference}
                  </p>
                ) : null}
                {item.acceptedAlternatives ? (
                  <p style={{ margin: "4px 0", fontSize: 13.5 }}>
                    <strong>بدائل مقبولة: </strong>
                    {item.acceptedAlternatives}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </section>

        <aside className="panel decision-panel opportunity-side">
          <h3>ملخص سريع</h3>
          <div className="deadline" style={{ marginTop: 10 }}>
            آخر موعد لتقديم العروض
            <strong>{formatDateTime(opportunity.submissionDeadline)}</strong>
          </div>
          <p style={{ fontSize: 13.5, margin: 0 }}>
            التوصيل: {opportunity.deliveryCity}
            {opportunity.deliveryDistrict ? ` — ${opportunity.deliveryDistrict}` : ""}
          </p>
          <p style={{ fontSize: 13.5, margin: 0 }}>البنود: {items.length}</p>
          <p style={{ fontSize: 13.5, margin: 0 }}>
            التسليم المطلوب: {formatDate(opportunity.neededByDate)}
          </p>

          {existingOffer ? (
            <div style={{ display: "grid", gap: 8 }}>
              <StatusPill kind="offer" value={existingOffer.status} />
              <Link
                className="btn outline wide"
                href={`/supplier/offers/${existingOffer.id}`}
              >
                عرض تفاصيل عرضك
              </Link>
            </div>
          ) : canOffer ? (
            <Link
              className="btn primary wide"
              href={`/supplier/opportunities/${id}/offer`}
            >
              تقديم عرض
            </Link>
          ) : (
            <p className="warning" style={{ margin: 0 }}>
              {state === "deadline_passed"
                ? "انتهى الموعد النهائي لتقديم العروض على هذا الطلب."
                : OPPORTUNITY_STATE_LABEL[state]}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
