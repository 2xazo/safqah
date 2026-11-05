import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { complaints, organizations } from "@/db/schema";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { COMPLAINT_STATUS, statusTone } from "@/lib/labels";

export default async function AdminComplaintsPage() {
  await requireRole(["admin"]);
  const db = getDb();

  const rows = await db
    .select({
      id: complaints.id,
      code: complaints.code,
      title: complaints.title,
      status: complaints.status,
      createdAt: complaints.createdAt,
      orgName: organizations.name,
    })
    .from(complaints)
    .innerJoin(organizations, eq(organizations.id, complaints.organizationId))
    .orderBy(desc(complaints.createdAt));

  return (
    <>
      <PageHeader title="البلاغات" description="بلاغات المنشآت عبر المنصة." />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد بلاغات" />
      ) : (
        <DataTable headers={["الرمز", "المنشأة", "العنوان", "الحالة", "التاريخ"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>{r.orgName}</td>
              <td>
                <strong>{r.title}</strong>
              </td>
              <td>
                <Badge tone={statusTone(r.status)}>
                  {COMPLAINT_STATUS[r.status] ?? r.status}
                </Badge>
              </td>
              <td>{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
