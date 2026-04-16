import { NextRequest, NextResponse } from "next/server";
import { createProxy } from "../../_proxy";
import { apiBackendUrl } from "@/services/_shared/fetch-server";
import { getProviderKey } from "@/db/provider-keys";

const proxy = createProxy(apiBackendUrl, "pipeline");
export const { GET, PUT, DELETE } = proxy;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  if (path.join("/") !== "run") {
    return proxy.POST(req, { params });
  }

  const body = (await req.json()) as {
    llm_provider?: string;
    llm_model?: string | null;
    api_key?: string | null;
  };

  if (!body.api_key && body.llm_provider) {
    body.api_key = getProviderKey(body.llm_provider);
  }

  const url = new URL("pipeline/run", apiBackendUrl);
  const upstream = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

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

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") || "application/json",
    },
  });
}
