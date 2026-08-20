import { Router } from "express";
import {
  createStudySession,
  deleteStudySession,
  getProgressSummary,
  getStudySession,
  listStudySessions,
  updateStudySession,
} from "../controllers/progressController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createStudySessionSchema,
  listStudySessionsSchema,
  progressSummarySchema,
  studySessionIdSchema,
  updateStudySessionSchema,
} from "../validators/progressValidators.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/summary",
  validateRequest(progressSummarySchema),
  asyncHandler(getProgressSummary),
);
router.get(
  "/study-sessions",
  validateRequest(listStudySessionsSchema),
  asyncHandler(listStudySessions),
);
router.post(
  "/study-sessions",
  validateRequest(createStudySessionSchema),
  asyncHandler(createStudySession),
);
router.get(
  "/study-sessions/:studySessionId",
  validateRequest(studySessionIdSchema),
  asyncHandler(getStudySession),
);
router.patch(
  "/study-sessions/:studySessionId",
  validateRequest(updateStudySessionSchema),
  asyncHandler(updateStudySession),
);
router.delete(
  "/study-sessions/:studySessionId",
  validateRequest(studySessionIdSchema),
  asyncHandler(deleteStudySession),
);

export default router;
