import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";

export function mockApiResponse(
  method: "get" | "post" | "put" | "patch" | "delete",
  url: string,
  body: Record<string, unknown>,
  status = 200,
) {
  server.use(http[method](url, () => HttpResponse.json(body, { status })));
}

export function mockApiError(
  method: "get" | "post" | "put" | "patch" | "delete",
  url: string,
  status: number,
  body?: Record<string, unknown>,
) {
  server.use(
    http[method](url, () =>
      HttpResponse.json(body ?? { message: "Error" }, { status }),
    ),
  );
}
