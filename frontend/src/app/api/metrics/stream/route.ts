import { apiBackendUrl } from "@/services/_shared/fetch-server";

export async function GET() {
  const upstream = await fetch(`${apiBackendUrl}/metrics/stream`, {
    cache: "no-store",
    headers: { Accept: "text/event-stream" },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
