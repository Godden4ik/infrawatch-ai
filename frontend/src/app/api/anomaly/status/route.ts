import { proxyStream } from "../../_proxy";

export async function GET(req: Request) {
  return proxyStream(req, "/anomaly/status");
}
