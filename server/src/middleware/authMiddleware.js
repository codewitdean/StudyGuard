import { verifyAuthToken } from "../utils/tokens.js";

function getBearerToken(authorizationHeader) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}

function isAuthPayload(payload) {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof payload.sub === "string" &&
    typeof payload.email === "string"
  );
}

export function requireAuth(req, res, next) {
  const token = getBearerToken(req.get("authorization"));

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        message: "Authentication required.",
      },
    });
  }

  try {
    const payload = verifyAuthToken(token);

    if (!isAuthPayload(payload)) {
      throw new Error("Invalid auth token payload.");
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
    };

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        message: "Invalid or expired token.",
      },
    });
  }
}
