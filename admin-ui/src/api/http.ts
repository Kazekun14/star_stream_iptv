// src/api/http.ts
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

type AnyObj = Record<string, any>;

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

function isFormData(x: any): x is FormData {
  return typeof FormData !== "undefined" && x instanceof FormData;
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: {
      "Accept": "application/json",
    },
  };

  // If multipart/FormData, DO NOT set Content-Type; browser will set boundary.
  if (body !== undefined) {
    if (isFormData(body)) {
      init.body = body;
      // no Content-Type
    } else {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  } else {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, init);

  const data = await readJson(res);

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: AnyObj) => request<T>("POST", path, body),
  put: <T>(path: string, body?: AnyObj) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),

  // NEW: for multipart and any custom request shape
  request: <T>(path: string, init?: { method?: string; body?: any }) =>
    request<T>((init?.method || "GET").toUpperCase(), path, init?.body),
};
