"use server";

import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { clearSessionCookie, setSessionCookie, type AppRole } from "@/lib/auth";
import { DEMO_ACCOUNTS } from "@/lib/constants";

export type AuthState = { error: string | null };

const ROLE_HOME: Record<AppRole, string> = {
  buyer: "/buyer",
  supplier: "/supplier",
  admin: "/admin",
};

const INVALID_CREDENTIALS = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
const MISSING_FIELDS = "الرجاء إدخال البريد الإلكتروني وكلمة المرور.";
const INACTIVE_ACCOUNT = "هذا الحساب موقوف. يرجى التواصل مع إدارة المنصة.";
const DEMO_DISABLED = "الدخول التجريبي غير مفعّل في هذه البيئة.";

function demoAuthEnabled() {
  return process.env.DEMO_AUTH_ENABLED !== "false";
}

async function verifyCredentials(email: string, password: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];
  if (!user) return { error: INVALID_CREDENTIALS } as const;
  if (!user.isActive) return { error: INACTIVE_ACCOUNT } as const;

  const matches = await compare(password, user.passwordHash);
  if (!matches) return { error: INVALID_CREDENTIALS } as const;

  return { user } as const;
}

export async function loginAction(
  email: string,
  password: string,
): Promise<AuthState> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { error: MISSING_FIELDS };
  }

  const result = await verifyCredentials(normalizedEmail, password);
  if ("error" in result) {
    return { error: result.error ?? INVALID_CREDENTIALS };
  }

  await setSessionCookie(result.user.id);
  redirect(ROLE_HOME[result.user.role]);
}

export async function demoLoginAction(role: AppRole): Promise<AuthState> {
  if (!demoAuthEnabled()) {
    return { error: DEMO_DISABLED };
  }

  const account = DEMO_ACCOUNTS.find((item) => item.role === role);
  if (!account) {
    return { error: DEMO_DISABLED };
  }

  const result = await verifyCredentials(account.email, account.password);
  if ("error" in result) {
    return {
      error:
        "تعذّر الدخول بالحساب التجريبي. تأكد من تشغيل أمر تهيئة البيانات: npm run db:seed",
    };
  }

  await setSessionCookie(result.user.id);
  redirect(ROLE_HOME[result.user.role]);
}

export async function loginFormAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  return loginAction(email, password);
}

export async function demoLoginFormAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const role = String(formData.get("role") ?? "");
  if (role !== "buyer" && role !== "supplier" && role !== "admin") {
    return { error: DEMO_DISABLED };
  }
  return demoLoginAction(role);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
