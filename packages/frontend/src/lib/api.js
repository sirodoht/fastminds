export async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const t = localStorage.getItem("token");
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(url, { ...options, headers });
  const shouldExpireAuth = options.expireAuthOnUnauthorized !== false;

  if (res.status === 401 && shouldExpireAuth) {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth:expired"));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}
