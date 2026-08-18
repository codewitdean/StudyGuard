import { Router } from "express";
import { register } from "../controllers/authController.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { registerSchema } from "../validators/authValidators.js";

const router = Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  asyncHandler(register),
);

export default router;
