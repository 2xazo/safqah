import { redirect } from "next/navigation";
import { getCurrentSession, type AppRole, type SessionUser } from "@/lib/auth";

export async function requireRole(roles: AppRole[]): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }
  if (!roles.includes(session.role)) {
    redirect("/unauthorized");
  }
  return session;
}
