import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-8d-login-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "login-test-%@example.com";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
}

async function registerTestUser({
  name = "Maya Chen",
  email = "login-test-user@example.com",
  password = "correct-password",
} = {}) {
  return request(app)
    .post("/api/auth/register")
    .send({ name, email, password });
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

describe("POST /api/auth/login", () => {
  it("returns safe user data and a token for valid credentials", async () => {
    await registerTestUser();

    const response = await request(app).post("/api/auth/login").send({
      email: "login-test-user@example.com",
      password: "correct-password",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      id: expect.any(String),
      name: "Maya Chen",
      email: "login-test-user@example.com",
      planningPriority: "balance_deadlines_wellbeing",
    });
    expect(JSON.stringify(response.body)).not.toContain("password_hash");
    expect(JSON.stringify(response.body)).not.toContain("correct-password");
  });

  it("lowercases the email before checking credentials", async () => {
    await registerTestUser({ email: "login-test-case@example.com" });

    const response = await request(app).post("/api/auth/login").send({
      email: "Login-Test-Case@Example.com",
      password: "correct-password",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe("login-test-case@example.com");
  });

  it("returns 401 for the wrong password", async () => {
    await registerTestUser();

    const response = await request(app).post("/api/auth/login").send({
      email: "login-test-user@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Invalid email or password.",
      },
    });
  });

  it("returns the same 401 message for an unknown email", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "login-test-unknown@example.com",
      password: "correct-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Invalid email or password.",
      },
    });
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "login-test-missing@example.com",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Validation failed.");
    expect(response.body.error.details[0].field).toBe("body.password");
  });

  it("returns 400 when the email is invalid", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "not-an-email",
      password: "correct-password",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Validation failed.");
  });
});
