import { writable, get } from "svelte/store";
import { api } from "./api.js";

export const currentRoute = writable({ path: "/", params: {} });
export const user = writable(null);
export const token = writable(localStorage.getItem("token") || null);
export const notificationUnreadCount = writable(0);

token.subscribe((value) => {
  if (value) localStorage.setItem("token", value);
  else localStorage.removeItem("token");
});

window.addEventListener("auth:expired", () => {
  user.set(null);
  token.set(null);
  notificationUnreadCount.set(0);
});

export async function login(username, password) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  token.set(data.token);
  user.set(data.user);
  return data;
}

export async function register(username, password, email) {
  const data = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, email }),
  });
  token.set(data.token);
  user.set(data.user);
  return data;
}

export async function verifyEmail(token) {
  return api("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification() {
  return api("/api/auth/resend-verification", {
    method: "POST",
  });
}

export function logout() {
  token.set(null);
  user.set(null);
  notificationUnreadCount.set(0);
}

export async function restoreSession() {
  const t = get(token);
  if (!t) return;
  try {
    const data = await api("/api/auth/me");
    user.set(data.user);
  } catch {
    token.set(null);
    user.set(null);
  }
}

export async function refreshNotificationUnreadCount() {
  if (!get(token)) {
    notificationUnreadCount.set(0);
    return 0;
  }

  const data = await api("/api/notifications/unread-count");
  notificationUnreadCount.set(data.unreadCount);
  return data.unreadCount;
}
