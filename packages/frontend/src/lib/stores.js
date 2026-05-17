import { writable, get } from "svelte/store";
import { api } from "./api.js";

export const currentRoute = writable({ path: "/", params: {} });
export const user = writable(null);
export const token = writable(localStorage.getItem("token") || null);

token.subscribe((value) => {
  if (value) localStorage.setItem("token", value);
  else localStorage.removeItem("token");
});

window.addEventListener("auth:expired", () => {
  user.set(null);
  token.set(null);
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

export async function register(username, password) {
  const data = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  token.set(data.token);
  user.set(data.user);
  return data;
}

export function logout() {
  token.set(null);
  user.set(null);
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
