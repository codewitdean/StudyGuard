import { query } from "../database/db.js";
import { conflict } from "../utils/httpErrors.js";
import { hashPassword } from "../utils/passwords.js";
import { createAuthToken } from "../utils/tokens.js";

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
  const result = await query("SELECT id FROM users WHERE email = $1", [email]);

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
