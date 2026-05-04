import { NextRequest } from "next/server";
import { proxyStream } from "../../_proxy";
import { getProviderKey } from "@/db/provider-keys";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Clone the request so we can read the body and still proxy it
  const body = (await req.json()) as {
    llm_provider?: string;
    llm_model?: string | null;
    api_key?: string | null;
  };

  // If no API key provided, try to get it from our local DB
  if (!body.api_key && body.llm_provider) {
    body.api_key = getProviderKey(body.llm_provider);
  }

  // Create a new request with the updated body
  const newReq = new NextRequest(req, {
    body: JSON.stringify(body),
  });

  return proxyStream(newReq, "/evaluation/run");
}
