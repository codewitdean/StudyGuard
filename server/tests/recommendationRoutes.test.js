import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-13b-recommendation-routes-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "recommendation-test-%@example.com";
const exampleRecommendationId = "11111111-1111-4111-8111-111111111111";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
}

async function createTestStudent(label = "student") {
  const email = "recommendation-test-" + label + "@example.com";
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Recommendation " + label,
      email,
      password: "correct-password",
    });

  return {
    email,
    token: response.body.data.token,
    user: response.body.data.user,
  };
}

async function createCourse(token, body = {}) {
  return request(app)
    .post("/api/courses")
    .set("Authorization", "Bearer " + token)
    .send({
      name: "Biology I",
      code: "BIO 101",
      color: "#10B981",
      ...body,
    });
}

async function createCoursework(token, body = {}) {
  return request(app)
    .post("/api/coursework")
    .set("Authorization", "Bearer " + token)
    .send({
      title: "Biology lab report",
      type: "assignment",
      dueAt: "2999-02-16T22:00:00.000Z",
      estimatedMinutes: 90,
      ...body,
    });
}

async function createStudyBlockForUser(userId, courseworkId = null, body = {}) {
  const planResult = await query(
    [
      "INSERT INTO study_plans (",
      "  user_id,",
      "  plan_start_date,",
      "  plan_end_date,",
      "  status,",
      "  planning_priority,",
      "  overload_status",
      ")",
      "VALUES ($1, $2, $3, 'draft', $4, 'balanced')",
      "RETURNING id;",
    ].join("\n"),
    [
      userId,
      body.planStartDate ?? "2027-02-15",
      body.planEndDate ?? "2027-02-21",
      body.planningPriority ?? "balance_deadlines_wellbeing",
    ],
  );
  const studyPlanId = planResult.rows[0].id;

  const blockResult = await query(
    [
      "INSERT INTO study_blocks (",
      "  user_id,",
      "  study_plan_id,",
      "  coursework_id,",
      "  block_type,",
      "  start_at,",
      "  end_at,",
      "  status,",
      "  explanation",
      ")",
      "VALUES ($1, $2, $3, $4, $5, $6, 'planned', $7)",
      "RETURNING id;",
    ].join("\n"),
    [
      userId,
      studyPlanId,
      courseworkId,
      body.blockType ?? "study",
      body.startAt ?? "2027-02-15T14:00:00.000Z",
      body.endAt ?? "2027-02-15T15:00:00.000Z",
      body.explanation ?? "Seeded recommendation test block.",
    ],
  );

  return {
    id: blockResult.rows[0].id,
    studyPlanId,
  };
}

async function createRecommendation(token, body = {}) {
  return request(app)
    .post("/api/recommendations")
    .set("Authorization", "Bearer " + token)
    .send({
      type: "move_block",
      title: "Move biology review earlier",
      reason: "This block is too close to the deadline.",
      proposedChange: {
        action: "move_block",
      },
      ...body,
    });
}

async function editRecommendation(token, recommendationId, editedChange) {
  return request(app)
    .patch("/api/recommendations/" + recommendationId)
    .set("Authorization", "Bearer " + token)
    .send({ editedChange });
}

async function approveRecommendation(token, recommendationId) {
  return request(app)
    .post("/api/recommendations/" + recommendationId + "/approve")
    .set("Authorization", "Bearer " + token)
    .send({});
}

async function rejectRecommendation(token, recommendationId) {
  return request(app)
    .post("/api/recommendations/" + recommendationId + "/reject")
    .set("Authorization", "Bearer " + token)
    .send({});
}

function getCourse(response) {
  return response.body.data.course;
}

function getCourseworkItem(response) {
  return response.body.data.courseworkItem;
}

function getRecommendation(response) {
  return response.body.data.recommendation;
}

beforeAll(async () => {
  await deleteTestUsers();
});

beforeEach(async () => {
  await deleteTestUsers();
});

afterAll(async () => {
  await deleteTestUsers();
  await closeDatabase();
});

describe("/api/recommendations", () => {
  it("requires authentication for every recommendation route", async () => {
    const responses = await Promise.all([
      request(app).get("/api/recommendations"),
      request(app).post("/api/recommendations").send({}),
      request(app).get("/api/recommendations/" + exampleRecommendationId),
      request(app)
        .patch("/api/recommendations/" + exampleRecommendationId)
        .send({ editedChange: {} }),
      request(app)
        .post("/api/recommendations/" + exampleRecommendationId + "/approve")
        .send({}),
      request(app)
        .post("/api/recommendations/" + exampleRecommendationId + "/reject")
        .send({}),
      request(app).delete("/api/recommendations/" + exampleRecommendationId),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe("Authentication required.");
    }
  });

  it("returns 400 for invalid bodies, filters, and id params", async () => {
    const student = await createTestStudent("invalid-input");

    const createResponse = await createRecommendation(student.token, {
      courseworkId: "not-a-uuid",
      type: "essay",
      title: "",
      reason: "",
      proposedChange: [],
    });
    const invalidChangeResponse = await createRecommendation(student.token, {
      proposedChange: [],
    });
    const listResponse = await request(app)
      .get("/api/recommendations?status=done")
      .set("Authorization", "Bearer " + student.token);
    const patchResponse = await request(app)
      .patch("/api/recommendations/" + exampleRecommendationId)
      .set("Authorization", "Bearer " + student.token)
      .send({ editedChange: null });
    const badIdResponse = await request(app)
      .get("/api/recommendations/not-a-uuid")
      .set("Authorization", "Bearer " + student.token);

    expect(createResponse.status).toBe(400);
    expect(invalidChangeResponse.status).toBe(400);
    expect(listResponse.status).toBe(400);
    expect(patchResponse.status).toBe(400);
    expect(badIdResponse.status).toBe(400);
    expect(createResponse.body.error.message).toBe("Validation failed.");
  });

  it("creates an owned recommendation with coursework and study block summaries", async () => {
    const student = await createTestStudent("create-owned");
    const courseResponse = await createCourse(student.token, {
      name: "Chemistry",
      code: "CHEM 201",
      color: "#2563EB",
    });
    const course = getCourse(courseResponse);
    const courseworkResponse = await createCoursework(student.token, {
      courseId: course.id,
      title: " Enzyme lab ",
      type: "project",
    });
    const coursework = getCourseworkItem(courseworkResponse);
    const studyBlock = await createStudyBlockForUser(
      student.user.id,
      coursework.id,
    );
    const proposedChange = {
      action: "move_block",
      studyBlockId: studyBlock.id,
      startAt: "2027-02-15T16:00:00.000Z",
      endAt: "2027-02-15T17:00:00.000Z",
    };

    const response = await createRecommendation(student.token, {
      courseworkId: coursework.id,
      studyBlockId: studyBlock.id,
      type: " move_block ",
      title: " Move enzyme lab earlier ",
      reason: " The current block is close to the deadline. ",
      proposedChange,
    });

    expect(response.status).toBe(201);
    expect(getRecommendation(response)).toMatchObject({
      id: expect.any(String),
      courseworkId: coursework.id,
      studyBlockId: studyBlock.id,
      type: "move_block",
      status: "pending",
      title: "Move enzyme lab earlier",
      reason: "The current block is close to the deadline.",
      proposedChange,
      editedChange: null,
      decidedAt: null,
      coursework: {
        id: coursework.id,
        title: "Enzyme lab",
        type: "project",
        course: {
          id: course.id,
          name: "Chemistry",
          code: "CHEM 201",
          color: "#2563EB",
        },
      },
      studyBlock: {
        id: studyBlock.id,
        studyPlanId: studyBlock.studyPlanId,
        blockType: "study",
        status: "planned",
      },
    });

    const storedRecommendation = await query(
      "SELECT user_id, status FROM recommendations WHERE id = $1",
      [getRecommendation(response).id],
    );

    expect(storedRecommendation.rows[0]).toMatchObject({
      user_id: student.user.id,
      status: "pending",
    });
  });

  it("returns 404 when attaching another student's coursework or study block", async () => {
    const student = await createTestStudent("attach-owner");
    const otherStudent = await createTestStudent("attach-other");
    const otherCourseworkResponse = await createCoursework(otherStudent.token, {
      title: "Private reading",
    });
    const otherCoursework = getCourseworkItem(otherCourseworkResponse);
    const otherStudyBlock = await createStudyBlockForUser(
      otherStudent.user.id,
      otherCoursework.id,
    );

    const courseworkResponse = await createRecommendation(student.token, {
      courseworkId: otherCoursework.id,
    });
    const studyBlockResponse = await createRecommendation(student.token, {
      studyBlockId: otherStudyBlock.id,
    });

    expect(courseworkResponse.status).toBe(404);
    expect(courseworkResponse.body.error.message).toBe(
      "Coursework item not found.",
    );
    expect(studyBlockResponse.status).toBe(404);
    expect(studyBlockResponse.body.error.message).toBe(
      "Study block not found.",
    );
  });

  it("lists owned recommendations with default and explicit filters", async () => {
    const student = await createTestStudent("filters-owner");
    const otherStudent = await createTestStudent("filters-other");
    const firstCoursework = getCourseworkItem(
      await createCoursework(student.token, { title: "First assignment" }),
    );
    const secondCoursework = getCourseworkItem(
      await createCoursework(student.token, { title: "Second assignment" }),
    );
    const firstBlock = await createStudyBlockForUser(
      student.user.id,
      firstCoursework.id,
      {
        startAt: "2027-02-15T14:00:00.000Z",
        endAt: "2027-02-15T15:00:00.000Z",
      },
    );
    const secondBlock = await createStudyBlockForUser(
      student.user.id,
      secondCoursework.id,
      {
        startAt: "2027-02-16T14:00:00.000Z",
        endAt: "2027-02-16T15:00:00.000Z",
      },
    );

    await createRecommendation(student.token, {
      courseworkId: firstCoursework.id,
      studyBlockId: firstBlock.id,
      type: "move_block",
      title: "Move block",
    });
    const addBreakResponse = await createRecommendation(student.token, {
      courseworkId: secondCoursework.id,
      studyBlockId: secondBlock.id,
      type: "add_break",
      title: "Add break",
      proposedChange: { action: "add_break" },
    });
    await approveRecommendation(
      student.token,
      getRecommendation(addBreakResponse).id,
    );
    const supportResponse = await createRecommendation(student.token, {
      type: "seek_support",
      title: "Seek support",
      proposedChange: { action: "seek_support" },
    });
    await rejectRecommendation(
      student.token,
      getRecommendation(supportResponse).id,
    );
    const effortResponse = await createRecommendation(student.token, {
      courseworkId: firstCoursework.id,
      type: "reestimate_effort",
      title: "Reestimate effort",
      proposedChange: { action: "reestimate_effort", estimatedMinutes: 120 },
    });
    await editRecommendation(
      student.token,
      getRecommendation(effortResponse).id,
      {
        action: "reestimate_effort",
        estimatedMinutes: 150,
      },
    );
    await createRecommendation(otherStudent.token, {
      title: "Other pending",
    });

    const defaultResponse = await request(app)
      .get("/api/recommendations")
      .set("Authorization", "Bearer " + student.token);
    const approvedResponse = await request(app)
      .get("/api/recommendations?status=approved")
      .set("Authorization", "Bearer " + student.token);
    const moveTypeResponse = await request(app)
      .get("/api/recommendations?status=all&type=move_block")
      .set("Authorization", "Bearer " + student.token);
    const courseworkResponse = await request(app)
      .get("/api/recommendations?courseworkId=" + firstCoursework.id)
      .set("Authorization", "Bearer " + student.token);
    const studyBlockResponse = await request(app)
      .get("/api/recommendations?status=all&studyBlockId=" + secondBlock.id)
      .set("Authorization", "Bearer " + student.token);

    expect(defaultResponse.status).toBe(200);
    expect(defaultResponse.body.data.recommendations).toHaveLength(2);
    expect(
      defaultResponse.body.data.recommendations.map(
        (recommendation) => recommendation.title,
      ),
    ).toEqual(expect.arrayContaining(["Move block", "Reestimate effort"]));
    expect(
      approvedResponse.body.data.recommendations.map((item) => item.title),
    ).toEqual(["Add break"]);
    expect(
      moveTypeResponse.body.data.recommendations.map((item) => item.title),
    ).toEqual(["Move block"]);
    expect(
      courseworkResponse.body.data.recommendations.map((item) => item.title),
    ).toEqual(expect.arrayContaining(["Move block", "Reestimate effort"]));
    expect(
      studyBlockResponse.body.data.recommendations.map((item) => item.title),
    ).toEqual(["Add break"]);
  });

  it("returns 404 for another student's recommendation", async () => {
    const student = await createTestStudent("private-owner");
    const otherStudent = await createTestStudent("private-other");
    const otherRecommendationResponse = await createRecommendation(
      otherStudent.token,
      { title: "Private recommendation" },
    );
    const otherRecommendationId = getRecommendation(
      otherRecommendationResponse,
    ).id;

    const getResponse = await request(app)
      .get("/api/recommendations/" + otherRecommendationId)
      .set("Authorization", "Bearer " + student.token);
    const editResponse = await editRecommendation(
      student.token,
      otherRecommendationId,
      {
        action: "move_block",
      },
    );
    const approveResponse = await approveRecommendation(
      student.token,
      otherRecommendationId,
    );
    const rejectResponse = await rejectRecommendation(
      student.token,
      otherRecommendationId,
    );
    const deleteResponse = await request(app)
      .delete("/api/recommendations/" + otherRecommendationId)
      .set("Authorization", "Bearer " + student.token);

    expect(getResponse.status).toBe(404);
    expect(editResponse.status).toBe(404);
    expect(approveResponse.status).toBe(404);
    expect(rejectResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);

    const ownerResponse = await request(app)
      .get("/api/recommendations/" + otherRecommendationId)
      .set("Authorization", "Bearer " + otherStudent.token);

    expect(ownerResponse.status).toBe(200);
    expect(getRecommendation(ownerResponse).title).toBe(
      "Private recommendation",
    );
  });

  it("edits a pending recommendation while preserving the proposed change", async () => {
    const student = await createTestStudent("edit");
    const proposedChange = {
      action: "move_block",
      startAt: "2027-02-15T14:00:00.000Z",
      endAt: "2027-02-15T15:00:00.000Z",
    };
    const editedChange = {
      action: "move_block",
      startAt: "2027-02-15T16:00:00.000Z",
      endAt: "2027-02-15T17:00:00.000Z",
    };
    const createdResponse = await createRecommendation(student.token, {
      proposedChange,
    });
    const recommendationId = getRecommendation(createdResponse).id;

    const response = await editRecommendation(
      student.token,
      recommendationId,
      editedChange,
    );

    expect(response.status).toBe(200);
    expect(getRecommendation(response)).toMatchObject({
      id: recommendationId,
      status: "edited",
      proposedChange,
      editedChange,
      decidedAt: expect.any(String),
    });

    const storedRecommendation = await query(
      "SELECT status, edited_change, decided_at FROM recommendations WHERE id = $1",
      [recommendationId],
    );

    expect(storedRecommendation.rows[0].status).toBe("edited");
    expect(storedRecommendation.rows[0].edited_change).toEqual(editedChange);
    expect(storedRecommendation.rows[0].decided_at).toBeTruthy();
  });

  it("approves pending and edited recommendations", async () => {
    const student = await createTestStudent("approve");
    const pendingResponse = await createRecommendation(student.token, {
      title: "Approve pending",
    });
    const editedResponse = await createRecommendation(student.token, {
      title: "Approve edited",
    });
    const editedChange = {
      action: "move_block",
      startAt: "2027-02-15T16:00:00.000Z",
      endAt: "2027-02-15T17:00:00.000Z",
    };

    await editRecommendation(
      student.token,
      getRecommendation(editedResponse).id,
      editedChange,
    );

    const approvedPendingResponse = await approveRecommendation(
      student.token,
      getRecommendation(pendingResponse).id,
    );
    const approvedEditedResponse = await approveRecommendation(
      student.token,
      getRecommendation(editedResponse).id,
    );

    expect(approvedPendingResponse.status).toBe(200);
    expect(getRecommendation(approvedPendingResponse)).toMatchObject({
      status: "approved",
      editedChange: null,
      decidedAt: expect.any(String),
    });
    expect(approvedEditedResponse.status).toBe(200);
    expect(getRecommendation(approvedEditedResponse)).toMatchObject({
      status: "approved",
      editedChange,
      decidedAt: expect.any(String),
    });
  });

  it("rejects pending and edited recommendations", async () => {
    const student = await createTestStudent("reject");
    const pendingResponse = await createRecommendation(student.token, {
      title: "Reject pending",
    });
    const editedResponse = await createRecommendation(student.token, {
      title: "Reject edited",
    });

    await editRecommendation(
      student.token,
      getRecommendation(editedResponse).id,
      {
        action: "move_block",
      },
    );

    const rejectedPendingResponse = await rejectRecommendation(
      student.token,
      getRecommendation(pendingResponse).id,
    );
    const rejectedEditedResponse = await rejectRecommendation(
      student.token,
      getRecommendation(editedResponse).id,
    );

    expect(rejectedPendingResponse.status).toBe(200);
    expect(getRecommendation(rejectedPendingResponse)).toMatchObject({
      status: "rejected",
      decidedAt: expect.any(String),
    });
    expect(rejectedEditedResponse.status).toBe(200);
    expect(getRecommendation(rejectedEditedResponse)).toMatchObject({
      status: "rejected",
      decidedAt: expect.any(String),
    });
  });

  it("returns 409 for terminal recommendation status transitions", async () => {
    const student = await createTestStudent("terminal");
    const approvedResponse = await createRecommendation(student.token, {
      title: "Approved terminal",
    });
    const rejectedResponse = await createRecommendation(student.token, {
      title: "Rejected terminal",
    });
    const approvedId = getRecommendation(approvedResponse).id;
    const rejectedId = getRecommendation(rejectedResponse).id;

    await approveRecommendation(student.token, approvedId);
    await rejectRecommendation(student.token, rejectedId);

    const editApprovedResponse = await editRecommendation(
      student.token,
      approvedId,
      {
        action: "move_block",
      },
    );
    const approveApprovedResponse = await approveRecommendation(
      student.token,
      approvedId,
    );
    const rejectApprovedResponse = await rejectRecommendation(
      student.token,
      approvedId,
    );
    const editRejectedResponse = await editRecommendation(
      student.token,
      rejectedId,
      {
        action: "move_block",
      },
    );

    expect(editApprovedResponse.status).toBe(409);
    expect(approveApprovedResponse.status).toBe(409);
    expect(rejectApprovedResponse.status).toBe(409);
    expect(editRejectedResponse.status).toBe(409);
    expect(editApprovedResponse.body.error.message).toBe(
      "Recommendation is already approved.",
    );
    expect(editRejectedResponse.body.error.message).toBe(
      "Recommendation is already rejected.",
    );
  });

  it("deletes one owned recommendation", async () => {
    const student = await createTestStudent("delete");
    const createdResponse = await createRecommendation(student.token, {
      title: "Delete recommendation",
    });
    const recommendationId = getRecommendation(createdResponse).id;

    const deleteResponse = await request(app)
      .delete("/api/recommendations/" + recommendationId)
      .set("Authorization", "Bearer " + student.token);
    const getResponse = await request(app)
      .get("/api/recommendations/" + recommendationId)
      .set("Authorization", "Bearer " + student.token);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.text).toBe("");
    expect(getResponse.status).toBe(404);
  });
});
