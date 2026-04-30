import { NextRequest, NextResponse } from "next/server";
import { apiBackendUrl, prometheusUrl } from "@/services/_shared/fetch-server";

export function createProxy(baseUrl: string, prefix?: string) {
  async function handler(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
  ) {
    const { path } = await params;
    const segments = prefix ? [prefix, ...path] : path;
    const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    const url = new URL(segments.join("/"), base);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const headers = new Headers();
    headers.set(
      "Content-Type",
      req.headers.get("Content-Type") || "application/json",
    );
    const providerKey = req.headers.get("X-Provider-Key");
    if (providerKey) headers.set("X-Provider-Key", providerKey);

    const init: RequestInit = {
      method: req.method,
      headers,
      cache: "no-store",
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.text();
    }

    const upstream = await fetch(url.toString(), init);

    // Stream SSE responses directly
    if (
      upstream.headers.get("content-type")?.includes("text/event-stream")
    ) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
      },
    });
  }

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
  };
}

export async function proxyStream(req: Request, path: string) {
  const base = apiBackendUrl.endsWith("/") ? apiBackendUrl : apiBackendUrl + "/";
  const url = new URL(path.startsWith("/") ? path.slice(1) : path, base);

  const headers = new Headers();
  headers.set(
    "Content-Type",
    req.headers.get("Content-Type") || "application/json",
  );
  const providerKey = req.headers.get("X-Provider-Key");
  if (providerKey) headers.set("X-Provider-Key", providerKey);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const upstream = await fetch(url.toString(), init);

  if (upstream.headers.get("content-type")?.includes("text/event-stream")) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
    },
  });
}

export const backendProxy = createProxy(apiBackendUrl);
export const prometheusProxy = createProxy(prometheusUrl);
