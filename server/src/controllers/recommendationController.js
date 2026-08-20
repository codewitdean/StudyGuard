import {
  approveRecommendationForUser,
  createRecommendationForUser,
  deleteRecommendationForUser,
  editRecommendationForUser,
  getRecommendationForUser,
  listRecommendationsForUser,
  rejectRecommendationForUser,
} from "../services/recommendationService.js";

export async function listRecommendations(req, res) {
  const recommendations = await listRecommendationsForUser(
    req.user.id,
    req.validated.query,
  );

  res.status(200).json({
    success: true,
    data: {
      recommendations,
    },
  });
}

export async function createRecommendation(req, res) {
  const recommendation = await createRecommendationForUser(
    req.user.id,
    req.validated.body,
  );

  res.status(201).json({
    success: true,
    data: {
      recommendation,
    },
  });
}

export async function getRecommendation(req, res) {
  const recommendation = await getRecommendationForUser(
    req.user.id,
    req.validated.params.recommendationId,
  );

  res.status(200).json({
    success: true,
    data: {
      recommendation,
    },
  });
}

export async function editRecommendation(req, res) {
  const recommendation = await editRecommendationForUser(
    req.user.id,
    req.validated.params.recommendationId,
    req.validated.body,
  );

  res.status(200).json({
    success: true,
    data: {
      recommendation,
    },
  });
}

export async function approveRecommendation(req, res) {
  const recommendation = await approveRecommendationForUser(
    req.user.id,
    req.validated.params.recommendationId,
  );

  res.status(200).json({
    success: true,
    data: {
      recommendation,
    },
  });
}

export async function rejectRecommendation(req, res) {
  const recommendation = await rejectRecommendationForUser(
    req.user.id,
    req.validated.params.recommendationId,
  );

  res.status(200).json({
    success: true,
    data: {
      recommendation,
    },
  });
}

export async function deleteRecommendation(req, res) {
  await deleteRecommendationForUser(
    req.user.id,
    req.validated.params.recommendationId,
  );

  res.status(204).send();
}
