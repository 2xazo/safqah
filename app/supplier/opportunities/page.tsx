import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { offers, purchaseRequestItems } from "@/db/schema";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  opportunityActionLabel,
  opportunityState,
  OPPORTUNITY_STATE_LABEL,
} from "@/lib/workflow";
import { listPublishedOpportunitiesForSupplier } from "@/lib/matching";

const STATE_TONE: Record<string, "blue" | "gold" | "green" | "purple" | "gray" | "red"> = {
  available: "gold",
  offer_submitted: "blue",
  deadline_passed: "gray",
  selected_you: "green",
  selected_other: "red",
  closed: "gray",
};

export default async function SupplierOpportunitiesPage() {
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const opportunities = await listPublishedOpportunitiesForSupplier(session.organizationId);
  const requestIds = opportunities.map((o) => o.id);

  const [myOffers, itemCounts] = requestIds.length
    ? await Promise.all([
        db
          .select({
            requestId: offers.purchaseRequestId,
            status: offers.status,
            id: offers.id,
          })
          .from(offers)
          .where(
            and(
              eq(offers.supplierOrganizationId, session.organizationId),
              inArray(offers.purchaseRequestId, requestIds),
            ),
          ),
        db
          .select({
            requestId: purchaseRequestItems.purchaseRequestId,
            value: purchaseRequestItems.id,
          })
          .from(purchaseRequestItems)
          .where(inArray(purchaseRequestItems.purchaseRequestId, requestIds)),
      ])
    : [[], []];

  const offerByRequest = new Map(myOffers.map((o) => [o.requestId, o]));
  const itemCountMap = new Map<string, number>();
  for (const row of itemCounts) {
    itemCountMap.set(row.requestId, (itemCountMap.get(row.requestId) ?? 0) + 1);
  }

  const rows = opportunities
    .map((o) => {
      const mine = offerByRequest.get(o.id);
      return {
        ...o,
        hasOffer: Boolean(mine),
        isWinner: mine?.status === "selected",
        offerId: mine?.id,
        itemCount: itemCountMap.get(o.id) ?? 0,
      };
    })
    .sort((a, b) => {
      const da = a.submissionDeadline ? new Date(a.submissionDeadline).getTime() : Infinity;
      const db_ = b.submissionDeadline ? new Date(b.submissionDeadline).getTime() : Infinity;
      return da - db_;
    });

  return (
    <>
      <PageHeader
        title="فرص التوريد"
        description="طلبات الشراء المنشورة والمطابقة لمدينتك وتصنيفاتك."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد فرص توريد حالياً"
          description="ستظهر هنا طلبات الشراء المطابقة لمدينتك وتصنيفاتك فور نشرها."
        />
      ) : (
        <DataTable
          headers={[
            "الطلب",
            "عدد البنود",
            "مدينة التوصيل",
            "التسليم المطلوب",
            "آخر موعد",
            "الحالة",
            "الإجراء",
          ]}
        >
          {rows.map((row) => {
            const state = opportunityState({
              requestStatus: row.status,
              submissionDeadline: row.submissionDeadline,
              hasOffer: row.hasOffer,
              isWinner: row.isWinner,
            });
            const actionHref =
              state === "offer_submitted" && row.offerId
                ? `/supplier/offers/${row.offerId}`
                : `/supplier/opportunities/${row.id}`;
            return (
              <tr key={row.id}>
                <td>
                  <strong>{row.title}</strong>
                  <br />
                  <small className="ltr-iso" style={{ color: "var(--muted)" }}>
                    {row.code}
                  </small>
                </td>
                <td>{row.itemCount}</td>
                <td>
                  {row.deliveryCity}
                  {row.deliveryDistrict ? ` — ${row.deliveryDistrict}` : ""}
                </td>
                <td>{formatDate(row.neededByDate)}</td>
                <td>{formatDateTime(row.submissionDeadline)}</td>
                <td>
                  <Badge tone={STATE_TONE[state]}>{OPPORTUNITY_STATE_LABEL[state]}</Badge>
                </td>
                <td>
                  <Link href={actionHref}>{opportunityActionLabel(state)}</Link>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
