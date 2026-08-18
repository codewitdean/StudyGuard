import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-8c-register-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "register-test-%@example.com";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
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

describe("POST /api/auth/register", () => {
  it("creates a user, stores a password hash, and returns safe auth data", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: " Maya Chen ",
      email: "Register-Test-Success@Example.com",
      password: "correct-password",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      id: expect.any(String),
      name: "Maya Chen",
      email: "register-test-success@example.com",
      planningPriority: "balance_deadlines_wellbeing",
    });
    expect(JSON.stringify(response.body)).not.toContain("password_hash");
    expect(JSON.stringify(response.body)).not.toContain("correct-password");

    const storedUser = await query(
      "SELECT name, email, password_hash FROM users WHERE email = $1",
      ["register-test-success@example.com"],
    );

    expect(storedUser.rowCount).toBe(1);
    expect(storedUser.rows[0].name).toBe("Maya Chen");
    expect(storedUser.rows[0].email).toBe("register-test-success@example.com");
    expect(storedUser.rows[0].password_hash).not.toBe("correct-password");
    expect(storedUser.rows[0].password_hash.length).toBeGreaterThan(20);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: "register-test-missing@example.com",
      password: "correct-password",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Validation failed.");
    expect(response.body.error.details[0].field).toBe("body.name");
  });

  it("returns 400 when the email is invalid", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Maya Chen",
      email: "not-an-email",
      password: "correct-password",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Validation failed.");
  });

  it("returns 400 when the password is too short", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Maya Chen",
      email: "register-test-short-password@example.com",
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Validation failed.");
  });

  it("returns 409 when the email is already registered", async () => {
    const body = {
      name: "Maya Chen",
      email: "register-test-duplicate@example.com",
      password: "correct-password",
    };

    await request(app).post("/api/auth/register").send(body).expect(201);
    const response = await request(app).post("/api/auth/register").send(body);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Email is already registered.",
      },
    });
  });
});
