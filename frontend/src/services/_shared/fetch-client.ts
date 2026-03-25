import { ApiError } from "./errors";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

export async function apiClient<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, ...init } = options;
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, "CLIENT_FETCH_FAILED", body);
  }

  return res.json();
}

export async function apiClientStream(
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { params, ...init } = options;
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, "STREAM_FAILED", body);
  }

  return res;
}
