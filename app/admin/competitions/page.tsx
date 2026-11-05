import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { competitions } from "@/db/schema";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { COMPETITION_STATUS, statusTone } from "@/lib/labels";
import { isCompetitionRevealed } from "@/lib/bids";

export default async function AdminCompetitionsPage() {
  await requireRole(["admin"]);
  const db = getDb();
  const rows = await db
    .select()
    .from(competitions)
    .orderBy(desc(competitions.createdAt));

  return (
    <>
      <PageHeader title="المنافسات" description="إدارة المنافسات السرية والترسية." />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد منافسات" />
      ) : (
        <DataTable
          headers={["الرمز", "العنوان", "الحالة", "الإغلاق", "الفتح", "السرية", ""]}
        >
          {rows.map((r) => {
            const revealed = isCompetitionRevealed(r);
            return (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>
                  <strong>{r.title}</strong>
                </td>
                <td>
                  <Badge tone={statusTone(r.status)}>
                    {COMPETITION_STATUS[r.status] ?? r.status}
                  </Badge>
                </td>
                <td>{formatDateTime(r.submissionDeadline)}</td>
                <td>{formatDateTime(r.revealAt)}</td>
                <td>{revealed ? "مفتوحة" : "مقفلة"}</td>
                <td>
                  <Link href={`/admin/competitions/${r.id}`}>عرض</Link>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
