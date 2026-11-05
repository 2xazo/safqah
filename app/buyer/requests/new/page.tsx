import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { branches, categories, deliveryAddresses } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { RequestComposer } from "@/components/request-composer";

export default async function NewBuyerRequestPage() {
  const session = await requireRole(["buyer"]);
  const db = getDb();

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories);

  const branchRows = await db
    .select({
      id: branches.id,
      name: branches.name,
      city: branches.city,
      district: branches.district,
    })
    .from(branches)
    .where(eq(branches.organizationId, session.organizationId));

  const branchIds = branchRows.map((b) => b.id);
  const addressRows = branchIds.length
    ? await db
        .select({
          id: deliveryAddresses.id,
          label: deliveryAddresses.label,
          district: deliveryAddresses.district,
          city: deliveryAddresses.city,
          branchId: deliveryAddresses.branchId,
        })
        .from(deliveryAddresses)
        .where(inArray(deliveryAddresses.branchId, branchIds))
    : [];

  return (
    <>
      <PageHeader
        title="إنشاء طلب شراء"
        description="أكمل معلومات الطلب والبنود، ثم راجع الملخص قبل النشر لاستقبال عروض الموردين."
      />
      <RequestComposer categories={categoryRows} branches={branchRows} addresses={addressRows} />
    </>
  );
}
