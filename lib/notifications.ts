import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, organizationMembers } from "@/db/schema";

export async function notifyUser(input: {
  userId: string;
  title: string;
  body: string;
  linkPath?: string;
}) {
  const db = getDb();
  await db.insert(notifications).values({
    userId: input.userId,
    title: input.title,
    body: input.body,
    linkPath: input.linkPath ?? null,
  });
}

export async function notifyOrganizationUsers(input: {
  organizationId: string;
  title: string;
  body: string;
  linkPath?: string;
}) {
  const db = getDb();
  const members = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, input.organizationId));

  for (const member of members) {
    await notifyUser({
      userId: member.userId,
      title: input.title,
      body: input.body,
      linkPath: input.linkPath,
    });
  }
}
