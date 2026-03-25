import { describe, it, expect } from "vitest";
import { ApiError } from "@/services/_shared/errors";

describe("ApiError", () => {
  it("sets message, status, and code", () => {
    const err = new ApiError(404, "NOT_FOUND", "Resource not found");
    expect(err.message).toBe("Resource not found");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("has name ApiError", () => {
    const err = new ApiError(500, "SERVER_ERROR", "oops");
    expect(err.name).toBe("ApiError");
  });

  it("is an instance of Error", () => {
    const err = new ApiError(400, "BAD_REQUEST", "bad");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of ApiError", () => {
    const err = new ApiError(400, "BAD_REQUEST", "bad");
    expect(err).toBeInstanceOf(ApiError);
  });
});
