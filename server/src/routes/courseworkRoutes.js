import { Router } from "express";
import {
  createCoursework,
  deleteCoursework,
  getCoursework,
  listCoursework,
  updateCoursework,
} from "../controllers/courseworkController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  courseworkIdSchema,
  createCourseworkSchema,
  listCourseworkSchema,
  updateCourseworkSchema,
} from "../validators/courseworkValidators.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listCourseworkSchema),
  asyncHandler(listCoursework),
);
router.post(
  "/",
  validateRequest(createCourseworkSchema),
  asyncHandler(createCoursework),
);
router.get(
  "/:courseworkId",
  validateRequest(courseworkIdSchema),
  asyncHandler(getCoursework),
);
router.patch(
  "/:courseworkId",
  validateRequest(updateCourseworkSchema),
  asyncHandler(updateCoursework),
);
router.delete(
  "/:courseworkId",
  validateRequest(courseworkIdSchema),
  asyncHandler(deleteCoursework),
);

export default router;
