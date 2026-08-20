import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-8e-current-user-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "me-test-%@example.com";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
}

async function registerTestUser({
  name = "Maya Chen",
  email = "me-test-user@example.com",
  password = "correct-password",
} = {}) {
  return request(app)
    .post("/api/auth/register")
    .send({ name, email, password });
}

async function loginTestUser({
  email = "me-test-user@example.com",
  password = "correct-password",
} = {}) {
  return request(app).post("/api/auth/login").send({ email, password });
}

beforeAll(async () => {
  await deleteTestUsers();
});

beforeEach(async () => {
  await deleteTestUsers();
});

afterAll(async () => {
  await deleteTestUsers();
  await closeDatabase();
});

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid registration token", async () => {
    const registerResponse = await registerTestUser();
    const token = registerResponse.body.data.token;

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      id: registerResponse.body.data.user.id,
      name: "Maya Chen",
      email: "me-test-user@example.com",
      planningPriority: "balance_deadlines_wellbeing",
    });
    expect(JSON.stringify(response.body)).not.toContain("password_hash");
    expect(JSON.stringify(response.body)).not.toContain("correct-password");
  });

  it("returns the current user for a valid login token", async () => {
    await registerTestUser({ email: "me-test-login-token@example.com" });
    const loginResponse = await loginTestUser({
      email: "me-test-login-token@example.com",
    });
    const token = loginResponse.body.data.token;

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(
      "me-test-login-token@example.com",
    );
  });

  it("returns 401 when the authorization header is missing", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Authentication required.",
      },
    });
  });

  it("returns 401 when the authorization header is not a bearer token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Token not-a-bearer-token");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Authentication required.");
  });

  it("returns 401 when the token cannot be verified", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid or expired token.");
  });

  it("returns 401 when the token points to a deleted user", async () => {
    const registerResponse = await registerTestUser({
      email: "me-test-deleted@example.com",
    });
    const token = registerResponse.body.data.token;

    await query("DELETE FROM users WHERE email = $1", [
      "me-test-deleted@example.com",
    ]);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid or expired token.");
  });
});

describe("PATCH /api/auth/me", () => {
  it("updates the current user's name", async () => {
    const registerResponse = await registerTestUser({
      email: "me-test-update-name@example.com",
    });
    const token = registerResponse.body.data.token;

    const response = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({ name: "  Maya C.  " });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      id: registerResponse.body.data.user.id,
      name: "Maya C.",
      email: "me-test-update-name@example.com",
      planningPriority: "balance_deadlines_wellbeing",
    });
    expect(JSON.stringify(response.body)).not.toContain("password_hash");
    expect(JSON.stringify(response.body)).not.toContain("correct-password");
  });

  it("updates planning priority", async () => {
    const registerResponse = await registerTestUser({
      email: "me-test-update-priority@example.com",
    });
    const token = registerResponse.body.data.token;

    const response = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({ planningPriority: "prevent_burnout" });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      email: "me-test-update-priority@example.com",
      name: "Maya Chen",
      planningPriority: "prevent_burnout",
    });
  });

  it("updates name and planning priority together", async () => {
    const registerResponse = await registerTestUser({
      email: "me-test-update-both@example.com",
    });
    const token = registerResponse.body.data.token;

    const response = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({
        name: "Maya Profile",
        planningPriority: "meet_deadlines",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      email: "me-test-update-both@example.com",
      name: "Maya Profile",
      planningPriority: "meet_deadlines",
    });
    expect(response.body.data.user.updatedAt).toBeTruthy();
  });

  it("returns 400 for empty, unknown, and invalid update bodies", async () => {
    const registerResponse = await registerTestUser({
      email: "me-test-invalid-update@example.com",
    });
    const token = registerResponse.body.data.token;

    const emptyResponse = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({});
    const unknownResponse = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({ email: "new@example.com" });
    const priorityResponse = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({ planningPriority: "always_study" });
    const blankNameResponse = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({ name: "   " });
    const longNameResponse = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({ name: "A".repeat(121) });

    for (const response of [
      emptyResponse,
      unknownResponse,
      priorityResponse,
      blankNameResponse,
      longNameResponse,
    ]) {
      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe("Validation failed.");
    }
  });

  it("returns 401 when updating without a valid authenticated user", async () => {
    const missingTokenResponse = await request(app)
      .patch("/api/auth/me")
      .send({ name: "Maya" });
    const invalidTokenResponse = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ name: "Maya" });

    const registerResponse = await registerTestUser({
      email: "me-test-update-deleted@example.com",
    });
    const deletedUserToken = registerResponse.body.data.token;

    await query("DELETE FROM users WHERE email = $1", [
      "me-test-update-deleted@example.com",
    ]);

    const deletedUserResponse = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + deletedUserToken)
      .send({ name: "Maya" });

    expect(missingTokenResponse.status).toBe(401);
    expect(missingTokenResponse.body.error.message).toBe(
      "Authentication required.",
    );
    expect(invalidTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.body.error.message).toBe(
      "Invalid or expired token.",
    );
    expect(deletedUserResponse.status).toBe(401);
    expect(deletedUserResponse.body.error.message).toBe(
      "Invalid or expired token.",
    );
  });

  it("updates only the signed-in user's profile", async () => {
    const ownerResponse = await registerTestUser({
      email: "me-test-owner-update@example.com",
    });
    const otherResponse = await registerTestUser({
      email: "me-test-other-update@example.com",
    });
    const token = ownerResponse.body.data.token;

    const response = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", "Bearer " + token)
      .send({ name: "Owner Updated", planningPriority: "custom" });

    const otherUser = await query(
      "SELECT name, planning_priority FROM users WHERE id = $1",
      [otherResponse.body.data.user.id],
    );

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: ownerResponse.body.data.user.id,
      name: "Owner Updated",
      planningPriority: "custom",
    });
    expect(otherUser.rows[0]).toMatchObject({
      name: "Maya Chen",
      planning_priority: "balance_deadlines_wellbeing",
    });
  });
});
