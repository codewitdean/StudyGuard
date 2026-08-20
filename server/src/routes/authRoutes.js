import { Router } from "express";
import {
  getCurrentUser,
  login,
  register,
  updateCurrentUser,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  loginSchema,
  registerSchema,
  updateCurrentUserSchema,
} from "../validators/authValidators.js";

const router = Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(register),
);
router.post("/login", validateRequest(loginSchema), asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(getCurrentUser));
router.patch(
  "/me",
  requireAuth,
  validateRequest(updateCurrentUserSchema),
  asyncHandler(updateCurrentUser),
);

export default router;
