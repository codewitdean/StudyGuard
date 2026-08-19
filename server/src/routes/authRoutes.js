import { Router } from "express";
import {
  getCurrentUser,
  login,
  register,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginSchema, registerSchema } from "../validators/authValidators.js";

const router = Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(register),
);
router.post("/login", validateRequest(loginSchema), asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(getCurrentUser));

export default router;
