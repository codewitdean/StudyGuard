import { Router } from "express";
import {
  createCourse,
  deleteCourse,
  getCourse,
  listCourses,
  updateCourse,
} from "../controllers/courseController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  courseIdSchema,
  createCourseSchema,
  listCoursesSchema,
  updateCourseSchema,
} from "../validators/courseValidators.js";

const router = Router();

router.use(requireAuth);

router.get("/", validateRequest(listCoursesSchema), asyncHandler(listCourses));
router.post(
  "/",
  validateRequest(createCourseSchema),
  asyncHandler(createCourse),
);
router.get(
  "/:courseId",
  validateRequest(courseIdSchema),
  asyncHandler(getCourse),
);
router.patch(
  "/:courseId",
  validateRequest(updateCourseSchema),
  asyncHandler(updateCourse),
);
router.delete(
  "/:courseId",
  validateRequest(courseIdSchema),
  asyncHandler(deleteCourse),
);

export default router;
