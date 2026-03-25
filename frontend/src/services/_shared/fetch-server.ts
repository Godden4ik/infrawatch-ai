import "server-only";
import { env } from "@/env";
import { ApiError } from "./errors";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

export async function serverFetch<T>(
  baseUrl: string,
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, ...init } = options;
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    ...init,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, "FETCH_FAILED", body);
  }

  return res.json();
}

export async function serverFetchStream(
  baseUrl: string,
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { params, ...init } = options;
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    ...init,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, "STREAM_FAILED", body);
  }

  return res;
}

export const apiBackendUrl = env.API_BACKEND_URL;
export const prometheusUrl = env.PROMETHEUS_URL;
