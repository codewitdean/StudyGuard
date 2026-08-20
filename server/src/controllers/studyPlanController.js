import {
  approveStudyPlanForUser,
  archiveStudyPlanForUser,
  generateStudyPlanForUser,
  getStudyPlanForUser,
  listStudyPlansForUser,
} from "../services/studyPlanService.js";

export async function listStudyPlans(req, res) {
  const studyPlans = await listStudyPlansForUser(
    req.user.id,
    req.validated.query,
  );

  res.status(200).json({
    success: true,
    data: {
      studyPlans,
    },
  });
}

export async function generateStudyPlan(req, res) {
  const studyPlanDetail = await generateStudyPlanForUser(
    req.user.id,
    req.validated.body,
  );

  res.status(201).json({
    success: true,
    data: studyPlanDetail,
  });
}

export async function getStudyPlan(req, res) {
  const studyPlanDetail = await getStudyPlanForUser(
    req.user.id,
    req.validated.params.studyPlanId,
  );

  res.status(200).json({
    success: true,
    data: studyPlanDetail,
  });
}

export async function approveStudyPlan(req, res) {
  const studyPlanDetail = await approveStudyPlanForUser(
    req.user.id,
    req.validated.params.studyPlanId,
  );

  res.status(200).json({
    success: true,
    data: studyPlanDetail,
  });
}

export async function archiveStudyPlan(req, res) {
  const studyPlanDetail = await archiveStudyPlanForUser(
    req.user.id,
    req.validated.params.studyPlanId,
  );

  res.status(200).json({
    success: true,
    data: studyPlanDetail,
  });
}
