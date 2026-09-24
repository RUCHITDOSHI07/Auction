import { AdminAuthError, requireAdmin as requireAdminSession } from "@/lib/auth/session";

export { AdminAuthError as AdminApiError };

export async function requireAdmin() {
  return requireAdminSession();
}