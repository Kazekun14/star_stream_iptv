import { http } from "./http";
import type { AdminMe, Ok } from "./types";

type LoginResponse = { ok: boolean; admin?: AdminMe; message?: string; error?: string };
type MeResponse = { ok: boolean; admin?: AdminMe; message?: string; error?: string };

export async function login(username: string, password: string, rememberMe = false): Promise<AdminMe> {
  const res = await http.post<LoginResponse>("/auth/login", { username, password, rememberMe });
  if (!res.ok || !res.admin) throw new Error(res.message || res.error || "Login failed");
  return res.admin;
}

export async function me(): Promise<AdminMe> {
  const res = await http.get<MeResponse>("/auth/me");
  if (!res.ok || !res.admin) throw new Error(res.message || res.error || "Not authenticated");
  return res.admin;
}

export async function logout(): Promise<void> {
  const res = await http.post<Ok>("/auth/logout", {});
  if (!res.ok) throw new Error(res.message || res.error || "Logout failed");
}

export type AdminSession = { ip_address: string | null; user_agent: string | null; created_at: string; last_seen_at: string; expires_at: string; is_current: number };
export async function updateAccount(payload: { username: string; full_name: string; email: string; current_password: string; new_password?: string }): Promise<AdminMe> {
  const res = await http.put<MeResponse>("/auth/me", payload);
  if (!res.ok || !res.admin) throw new Error(res.message || res.error || "Unable to update account");
  window.dispatchEvent(new CustomEvent("admin-account-updated", { detail: res.admin }));
  return res.admin;
}
export async function listAdminSessions(): Promise<AdminSession[]> {
  const res = await http.get<{ ok: boolean; sessions: AdminSession[]; message?: string }>("/auth/sessions");
  if (!res.ok) throw new Error(res.message || "Unable to load sessions");
  return res.sessions;
}
export async function revokeOtherSessions(current_password: string): Promise<void> {
  const res = await http.post<Ok>("/auth/sessions/revoke-others", { current_password });
  if (!res.ok) throw new Error(res.message || res.error || "Unable to sign out other sessions");
}
