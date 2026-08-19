import { query } from "../database/db.js";
import { conflict, unauthorized } from "../utils/httpErrors.js";
import { comparePasswords, hashPassword } from "../utils/passwords.js";
import { createAuthToken } from "../utils/tokens.js";

const invalidLoginError = "Invalid email or password.";
const invalidSessionError = "Invalid or expired token.";

function mapUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    planningPriority: row.planning_priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findUserByEmail(email) {
  const result = await query(
    `
      SELECT id, name, email, password_hash, planning_priority, created_at, updated_at
      FROM users
      WHERE email = $1;
    `,
    [email],
  );

  return result.rows[0] ?? null;
}

async function findUserById(id) {
  const result = await query(
    `
      SELECT id, name, email, planning_priority, created_at, updated_at
      FROM users
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function registerUser({ name, email, password }) {
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw conflict("Email is already registered.");
  }

  const passwordHash = await hashPassword(password);

  try {
    const result = await query(
      `
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, planning_priority, created_at, updated_at;
      `,
      [name, email, passwordHash],
    );

    const user = mapUserRow(result.rows[0]);
    const token = createAuthToken(user);

    return { user, token };
  } catch (error) {
    if (error.code === "23505") {
      throw conflict("Email is already registered.");
    }

    throw error;
  }
}

export async function loginUser({ email, password }) {
  const existingUser = await findUserByEmail(email);

  if (!existingUser) {
    throw unauthorized(invalidLoginError);
  }

  const passwordMatches = await comparePasswords(
    password,
    existingUser.password_hash,
  );

  if (!passwordMatches) {
    throw unauthorized(invalidLoginError);
  }

  const user = mapUserRow(existingUser);
  const token = createAuthToken(user);

  return { user, token };
}

export async function getCurrentUserById(userId) {
  const currentUser = await findUserById(userId);

  if (!currentUser) {
    throw unauthorized(invalidSessionError);
  }

  return mapUserRow(currentUser);
}
