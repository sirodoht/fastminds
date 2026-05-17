export async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const t = localStorage.getItem("token");
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth:expired"));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json();
}
