import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("GET /api/health", () => {
  it("returns the API status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.service).toBe("studyguard-api");
    expect(response.body.data.timestamp).toEqual(expect.any(String));
  });
});

describe("unknown API routes", () => {
  it("returns a JSON 404 response", async () => {
    const response = await request(app).get("/api/not-real");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Route not found",
      },
    });
  });
});
