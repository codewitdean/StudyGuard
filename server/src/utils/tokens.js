import jwt from "jsonwebtoken";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required.");
  }

  return secret;
}

export function createAuthToken(user) {
  return jwt.sign(
    {
      email: user.email,
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
      subject: user.id,
    },
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}
