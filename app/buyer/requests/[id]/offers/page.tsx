import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  offers,
  offerScores,
  organizations,
  purchaseOrders,
  purchaseRequests,
  supplierProfiles,
} from "@/db/schema";
import { Badge, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime, formatMoney, formatRating } from "@/lib/format";
import { isDeadlinePassed } from "@/lib/workflow";
import { scoreOffers, type OfferScoreResult } from "@/lib/offer-scoring";
import { advanceOfferDeadlineForDemo, selectOffer } from "@/app/actions/mutations";

const ACTIVE_OFFER_STATUSES = ["submitted", "locked", "selected", "not_selected"] as const;

export default async function BuyerRequestOffersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["buyer"]);
  const db = getDb();

  const [request] = await db
    .select()
    .from(purchaseRequests)
    .where(
      and(eq(purchaseRequests.id, id), eq(purchaseRequests.organizationId, session.organizationId)),
    )
    .limit(1);

  if (!request) notFound();

  const deadlinePassed = isDeadlinePassed(request.submissionDeadline);

  const offerRows = await db
    .select({
      id: offers.id,
      code: offers.code,
      status: offers.status,
      totalAmount: offers.totalAmount,
      deliveryFee: offers.deliveryFee,
      proposedDeliveryDate: offers.proposedDeliveryDate,
      meetsDeliveryDate: offers.meetsDeliveryDate,
      deliveryDaysDiff: offers.deliveryDaysDiff,
      paymentTerms: offers.paymentTerms,
      notes: offers.notes,
      submittedAt: offers.submittedAt,
      supplierOrganizationId: offers.supplierOrganizationId,
      supplierName: organizations.name,
      supplierCity: organizations.city,
      ratingAverage: supplierProfiles.ratingAverage,
    })
    .from(offers)
    .innerJoin(organizations, eq(organizations.id, offers.supplierOrganizationId))
    .leftJoin(supplierProfiles, eq(supplierProfiles.organizationId, offers.supplierOrganizationId))
    .where(
      and(
        eq(offers.purchaseRequestId, request.id),
        inArray(offers.status, [...ACTIVE_OFFER_STATUSES]),
      ),
    );

  const offerCount = offerRows.length;
  const scoreMap = new Map<string, OfferScoreResult>();

  if (deadlinePassed && offerRows.length > 0) {
    const dbScores = await db
      .select()
      .from(offerScores)
      .where(inArray(offerScores.offerId, offerRows.map((o) => o.id)));

    if (dbScores.length === offerRows.length) {
      for (const s of dbScores) {
        scoreMap.set(s.offerId, {
          offerId: s.offerId,
          priceScore: Number(s.priceScore),
          deliveryScore: Number(s.deliveryScore),
          ratingScore: Number(s.ratingScore),
          totalScore: Number(s.totalScore),
          isBestValue: s.isBestValue,
          isCheapest: s.isCheapest,
          isFastest: s.isFastest,
          isHighestRated: s.isHighestRated,
          explanation: s.explanation ?? "",
        });
      }
    } else {
      const computed = scoreOffers(
        offerRows.map((o) => ({
          offerId: o.id,
          totalAmount: Number(o.totalAmount),
          proposedDeliveryDate: o.proposedDeliveryDate,
          meetsDeliveryDate: o.meetsDeliveryDate,
          deliveryDaysDiff: o.deliveryDaysDiff,
          supplierRating: Number(o.ratingAverage ?? 0),
        })),
      );
      for (const s of computed) scoreMap.set(s.offerId, s);
    }
  }

  const rankedRows = deadlinePassed
    ? [...offerRows].sort(
        (a, b) => (scoreMap.get(b.id)?.totalScore ?? 0) - (scoreMap.get(a.id)?.totalScore ?? 0),
      )
    : offerRows;

  const topThreeIds = new Set(rankedRows.slice(0, 3).map((o) => o.id));
  const canSelect = request.status === "published" && deadlinePassed;
  const demoEnabled = process.env.DEMO_AUTH_ENABLED !== "false";

  const [relatedOrder] =
    request.status === "awarded"
      ? await db
          .select({ id: purchaseOrders.id, code: purchaseOrders.code })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseRequestId, request.id))
          .limit(1)
      : [];

  return (
    <>
      <PageHeader
        title={`عروض الطلب: ${request.title}`}
        description={request.code}
        actions={<StatusPill kind="purchaseRequest" value={request.status} />}
      />

      {request.status === "awarded" ? (
        <section className="sealed-banner">
          <span>✓</span>
          <div>
            <strong>تمت الترسية على أحد العروض وصدر أمر شراء</strong>
            {relatedOrder ? (
              <p>
                <Link href={`/buyer/purchase-orders/${relatedOrder.id}`}>
                  عرض أمر الشراء {relatedOrder.code}
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {!deadlinePassed ? (
        <section className="sealed-banner">
          <span>🔒</span>
          <div>
            <strong>باب التقديم لا يزال مفتوحًا — العروض مغلقة حتى الموعد النهائي</strong>
            <p>
              عدد العروض المستلمة حتى الآن: {offerCount} · الموعد النهائي:{" "}
              {formatDateTime(request.submissionDeadline)}
            </p>
          </div>
        </section>
      ) : null}

      {!deadlinePassed && demoEnabled ? (
        <form action={advanceOfferDeadlineForDemo} className="panel" style={{ marginBottom: 16 }}>
          <input type="hidden" name="purchaseRequestId" value={request.id} />
          <p className="warning" style={{ marginTop: 0 }}>
            أداة تجريبية: تقديم الموعد النهائي الآن لعرض المقارنة والاختيار فورًا (لأغراض العرض
            التوضيحي فقط).
          </p>
          <div className="panel-actions">
            <button className="btn outline" type="submit">
              تقديم الموعد النهائي الآن
            </button>
          </div>
        </form>
      ) : null}

      {deadlinePassed && offerRows.length === 0 ? (
        <EmptyState
          title="لم يصل أي عرض على هذا الطلب"
          description="انتهى الموعد النهائي دون استلام عروض من الموردين."
        />
      ) : null}

      {deadlinePassed && offerRows.length > 0 ? (
        <div style={{ display: "grid", gap: 14 }}>
          {rankedRows.map((offer, index) => {
            const score = scoreMap.get(offer.id);
            const isTop = topThreeIds.has(offer.id);
            return (
              <section
                key={offer.id}
                className={isTop ? "panel recommended-row" : "panel"}
                style={{ position: "relative" }}
              >
                <div className="supplier-identity">
                  <span>{offer.supplierName.trim().slice(0, 1) || "م"}</span>
                  <div>
                    <h3>{offer.supplierName}</h3>
                    <p>
                      {offer.supplierCity} · تقييم المورد: {formatRating(offer.ratingAverage)}
                    </p>
                  </div>
                  {isTop ? <Badge tone="gold">الترتيب #{index + 1} من {offerCount}</Badge> : null}
                  <StatusPill kind="offer" value={offer.status} />
                </div>

                {score ? (
                  <div className="rec-facts" style={{ marginTop: 12, flexWrap: "wrap" }}>
                    {score.isBestValue ? <Badge tone="gold">أفضل قيمة</Badge> : null}
                    {score.isCheapest ? <Badge tone="green">الأقل سعرًا</Badge> : null}
                    {score.isFastest ? <Badge tone="blue">الأسرع توصيلًا</Badge> : null}
                    {score.isHighestRated ? <Badge tone="purple">الأعلى تقييمًا</Badge> : null}
                  </div>
                ) : null}

                <div className="deal-numbers" style={{ marginTop: 14 }}>
                  <span>
                    <small>الإجمالي</small>
                    <b>{formatMoney(offer.totalAmount)}</b>
                  </span>
                  <span>
                    <small>رسوم التوصيل</small>
                    <b>{formatMoney(offer.deliveryFee)}</b>
                  </span>
                  <span>
                    <small>تاريخ التسليم المقترح</small>
                    <b>{formatDate(offer.proposedDeliveryDate)}</b>
                  </span>
                  <span>
                    <small>الالتزام بالموعد</small>
                    <b>{offer.meetsDeliveryDate ? "نعم" : `تأخر ${offer.deliveryDaysDiff} يوم`}</b>
                  </span>
                </div>

                {score ? (
                  <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
                    {score.explanation}
                  </p>
                ) : null}

                {offer.paymentTerms ? (
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                    شروط الدفع: {offer.paymentTerms}
                  </p>
                ) : null}
                {offer.notes ? (
                  <p style={{ fontSize: 11, color: "var(--muted)" }}>ملاحظات المورد: {offer.notes}</p>
                ) : null}

                {canSelect && !request.selectedOfferId && ["submitted", "locked"].includes(offer.status) ? (
                  <form
                    action={selectOffer}
                    style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}
                  >
                    <input type="hidden" name="offerId" value={offer.id} />
                    <label className="check">
                      <input type="checkbox" name="confirm" value="yes" required />
                      أؤكد اختيار هذا العرض وإصدار أمر الشراء
                    </label>
                    <div className="panel-actions">
                      <button className="btn primary" type="submit">
                        اختيار هذا العرض
                      </button>
                    </div>
                  </form>
                ) : offer.status === "selected" ? (
                  <div style={{ marginTop: 14 }}>
                    <Badge tone="green">تم اختيار هذا العرض</Badge>
                  </div>
                ) : offer.status === "not_selected" ? (
                  <div style={{ marginTop: 14 }}>
                    <Badge tone="gray">لم يُختر</Badge>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
