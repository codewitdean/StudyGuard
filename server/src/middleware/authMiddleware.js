import { verifyAuthToken } from "../utils/tokens.js";

function getBearerToken(authorizationHeader) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
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
