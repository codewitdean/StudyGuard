import express from "express";
import request from "supertest";
import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import { requireAuth } from "../src/middleware/authMiddleware.js";
import { validateRequest } from "../src/middleware/validateRequest.js";
import { comparePasswords, hashPassword } from "../src/utils/passwords.js";
import { createAuthToken, verifyAuthToken } from "../src/utils/tokens.js";

beforeEach(() => {
  process.env.JWT_SECRET = "stage-8b-test-secret";
  process.env.JWT_EXPIRES_IN = "1h";
});

describe("password helpers", () => {
  it("hashes a password and verifies the correct password", async () => {
    const password = "studyguard-password";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(await comparePasswords(password, hash)).toBe(true);
    expect(await comparePasswords("wrong-password", hash)).toBe(false);
  });
});

describe("token helpers", () => {
  it("creates and verifies a JWT for a user", () => {
    const user = {
      id: "2b3f8c3a-13c5-4f1c-8d6c-f970c7a1feda",
      email: "maya@example.com",
    };

    const token = createAuthToken(user);
    const payload = verifyAuthToken(token);

    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe(user.email);
  });
});

describe("requireAuth middleware", () => {
  function createProtectedApp() {
    const app = express();

    app.get("/protected", requireAuth, (req, res) => {
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    });

    return app;
  }

  it("rejects requests without a bearer token", async () => {
    const response = await request(createProtectedApp()).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Authentication required.",
      },
    });
  });

  it("rejects requests with an invalid token", async () => {
    const response = await request(createProtectedApp())
      .get("/protected")
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Invalid or expired token.",
      },
    });
  });

  it("adds the authenticated user to the request", async () => {
    const token = createAuthToken({
      id: "8c6f4a43-0be7-48d4-90e5-7fc751f84e42",
      email: "student@example.com",
    });

    const response = await request(createProtectedApp())
      .get("/protected")
      .set("Authorization", "Bearer " + token);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({
      id: "8c6f4a43-0be7-48d4-90e5-7fc751f84e42",
      email: "student@example.com",
    });
  });
});

describe("validateRequest middleware", () => {
  function createValidationApp() {
    const app = express();
    const schema = z.object({
      body: z.object({
        name: z.string().trim().min(1),
      }),
      params: z.object({}),
      query: z.object({}),
    });

    app.use(express.json());
    app.post("/students", validateRequest(schema), (req, res) => {
      res.status(200).json({
        success: true,
        data: req.validated.body,
      });
    });

    return app;
  }

  it("stores validated data on the request", async () => {
    const response = await request(createValidationApp())
      .post("/students")
      .send({ name: " Maya " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        name: "Maya",
      },
    });
  });

  it("returns a JSON validation error", async () => {
    const response = await request(createValidationApp())
      .post("/students")
      .send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Validation failed.");
    expect(response.body.error.details[0].field).toBe("body.name");
  });
});
