import { writable, get } from "svelte/store";
import { startAuthentication } from "@simplewebauthn/browser";
import { api } from "./api.js";

export const currentRoute = writable({ path: "/", params: {} });
export const token = writable(localStorage.getItem("token") || null);
export const user = writable(loadCachedUser());
export const notificationUnreadCount = writable(0);

token.subscribe((value) => {
  if (value) localStorage.setItem("token", value);
  else {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
  }
});

window.addEventListener("auth:expired", () => {
  user.set(null);
  token.set(null);
  notificationUnreadCount.set(0);
});

function loadCachedUser() {
  if (!localStorage.getItem("token")) return null;
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch {
    localStorage.removeItem("currentUser");
    return null;
  }
}

function setCurrentUser(value) {
  user.set(value);
  if (value) localStorage.setItem("currentUser", JSON.stringify(value));
  else localStorage.removeItem("currentUser");
}

export async function login(username, password) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  token.set(data.token);
  setCurrentUser(data.user);
  return data;
}

export async function loginWithPasskey(useBrowserAutofill = false) {
  const { options } = await api("/api/auth/passkey/login/options", {
    method: "POST",
  });
  const response = await startAuthentication({
    optionsJSON: options,
    useBrowserAutofill,
  });
  const data = await api("/api/auth/passkey/login/verify", {
    method: "POST",
    body: JSON.stringify({ response }),
  });
  token.set(data.token);
  setCurrentUser(data.user);
  return data;
}

export async function register(sessionId) {
  const data = await api("/api/auth/register/complete", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
  token.set(data.token);
  setCurrentUser(data.user);
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
  setCurrentUser(null);
  notificationUnreadCount.set(0);
}

export async function restoreSession() {
  const t = get(token);
  if (!t) return;
  try {
    const data = await api("/api/auth/me", { expireAuthOnUnauthorized: false });
    setCurrentUser(data.user);
  } catch (err) {
    if (err.status === 401 || err.status === 404) {
      token.set(null);
      setCurrentUser(null);
    }
  }
}

export async function refreshNotificationUnreadCount() {
  if (!get(token)) {
    notificationUnreadCount.set(0);
    return 0;
  }

  try {
    const data = await api("/api/notifications/unread-count", {
      expireAuthOnUnauthorized: false,
    });
    notificationUnreadCount.set(data.unreadCount);
    return data.unreadCount;
  } catch (err) {
    if (err.status === 401 || err.status === 404) {
      token.set(null);
      setCurrentUser(null);
      notificationUnreadCount.set(0);
    }
    return get(notificationUnreadCount);
  }
}
