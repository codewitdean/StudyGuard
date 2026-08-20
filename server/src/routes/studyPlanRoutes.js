import { Router } from "express";
import {
  approveStudyPlan,
  archiveStudyPlan,
  generateStudyPlan,
  getStudyPlan,
  listStudyPlans,
} from "../controllers/studyPlanController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  generateStudyPlanSchema,
  listStudyPlansSchema,
  studyPlanIdSchema,
} from "../validators/studyPlanValidators.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listStudyPlansSchema),
  asyncHandler(listStudyPlans),
);
router.post(
  "/generate",
  validateRequest(generateStudyPlanSchema),
  asyncHandler(generateStudyPlan),
);
router.get(
  "/:studyPlanId",
  validateRequest(studyPlanIdSchema),
  asyncHandler(getStudyPlan),
);
router.post(
  "/:studyPlanId/approve",
  validateRequest(studyPlanIdSchema),
  asyncHandler(approveStudyPlan),
);
router.post(
  "/:studyPlanId/archive",
  validateRequest(studyPlanIdSchema),
  asyncHandler(archiveStudyPlan),
);

export default router;
