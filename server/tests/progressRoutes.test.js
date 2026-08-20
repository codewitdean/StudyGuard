import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-14b-progress-routes-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "progress-test-%@example.com";
const exampleStudySessionId = "11111111-1111-4111-8111-111111111111";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
}

async function createTestStudent(label = "student") {
  const email = "progress-test-" + label + "@example.com";
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Progress " + label,
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
      dueAt: "2027-02-16T22:00:00.000Z",
      estimatedMinutes: 90,
      ...body,
    });
}

async function updateStoredCoursework(courseworkId, updates = {}) {
  await query(
    [
      "UPDATE coursework",
      "SET status = COALESCE($1, status),",
      "    completed_at = $2,",
      "    due_at = COALESCE($3, due_at)",
      "WHERE id = $4;",
    ].join("\n"),
    [
      updates.status ?? null,
      updates.completedAt ?? null,
      updates.dueAt ?? null,
      courseworkId,
    ],
  );
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
      body.explanation ?? "Seeded progress test block.",
    ],
  );

  return {
    id: blockResult.rows[0].id,
    studyPlanId,
  };
}

async function createStudySession(token, body = {}) {
  return request(app)
    .post("/api/progress/study-sessions")
    .set("Authorization", "Bearer " + token)
    .send({
      source: "manual",
      startedAt: "2027-02-15T14:00:00.000Z",
      endedAt: "2027-02-15T15:00:00.000Z",
      durationMinutes: 60,
      notes: "Focused study.",
      ...body,
    });
}

function getCourse(response) {
  return response.body.data.course;
}

function getCourseworkItem(response) {
  return response.body.data.courseworkItem;
}

function getStudySession(response) {
  return response.body.data.studySession;
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

describe("/api/progress", () => {
  it("requires authentication for every progress route", async () => {
    const responses = await Promise.all([
      request(app).get("/api/progress/summary"),
      request(app).get("/api/progress/study-sessions"),
      request(app).post("/api/progress/study-sessions").send({}),
      request(app).get("/api/progress/study-sessions/" + exampleStudySessionId),
      request(app)
        .patch("/api/progress/study-sessions/" + exampleStudySessionId)
        .send({ notes: "Updated" }),
      request(app).delete(
        "/api/progress/study-sessions/" + exampleStudySessionId,
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe("Authentication required.");
    }
  });

  it("returns 400 for invalid summary, list, create, update, and id inputs", async () => {
    const student = await createTestStudent("invalid-input");

    const invalidSummaryResponse = await request(app)
      .get("/api/progress/summary?from=not-a-date")
      .set("Authorization", "Bearer " + student.token);
    const reversedSummaryResponse = await request(app)
      .get("/api/progress/summary?from=2027-02-20&to=2027-02-15")
      .set("Authorization", "Bearer " + student.token);
    const longSummaryResponse = await request(app)
      .get("/api/progress/summary?from=2027-01-01&to=2028-01-03")
      .set("Authorization", "Bearer " + student.token);
    const invalidListResponse = await request(app)
      .get("/api/progress/study-sessions?source=imported&limit=101")
      .set("Authorization", "Bearer " + student.token);
    const invalidCreateResponse = await createStudySession(student.token, {
      source: "imported",
      startedAt: "2027-02-15T15:00:00.000Z",
      endedAt: "2027-02-15T14:00:00.000Z",
      durationMinutes: 0,
    });
    const invalidUpdateResponse = await request(app)
      .patch("/api/progress/study-sessions/" + exampleStudySessionId)
      .set("Authorization", "Bearer " + student.token)
      .send({});
    const badIdResponse = await request(app)
      .get("/api/progress/study-sessions/not-a-uuid")
      .set("Authorization", "Bearer " + student.token);

    expect(invalidSummaryResponse.status).toBe(400);
    expect(reversedSummaryResponse.status).toBe(400);
    expect(longSummaryResponse.status).toBe(400);
    expect(invalidListResponse.status).toBe(400);
    expect(invalidCreateResponse.status).toBe(400);
    expect(invalidUpdateResponse.status).toBe(400);
    expect(badIdResponse.status).toBe(400);
    expect(invalidCreateResponse.body.error.message).toBe("Validation failed.");
  });

  it("creates an owned study session with coursework and study block summaries", async () => {
    const student = await createTestStudent("create-owned");
    const course = getCourse(
      await createCourse(student.token, {
        name: "Chemistry",
        code: "CHEM 201",
        color: "#2563EB",
      }),
    );
    const coursework = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Enzyme lab",
        type: "project",
        estimatedMinutes: 180,
      }),
    );
    const studyBlock = await createStudyBlockForUser(
      student.user.id,
      coursework.id,
    );

    const response = await createStudySession(student.token, {
      courseworkId: coursework.id,
      studyBlockId: studyBlock.id,
      source: " manual ",
      startedAt: "2027-02-15T20:00:00.000Z",
      endedAt: "2027-02-15T21:15:00.000Z",
      durationMinutes: "75",
      notes: " Finished the outline. ",
    });

    expect(response.status).toBe(201);
    expect(getStudySession(response)).toMatchObject({
      id: expect.any(String),
      courseworkId: coursework.id,
      studyBlockId: studyBlock.id,
      source: "manual",
      startedAt: "2027-02-15T20:00:00.000Z",
      endedAt: "2027-02-15T21:15:00.000Z",
      durationMinutes: 75,
      notes: "Finished the outline.",
      coursework: {
        id: coursework.id,
        title: "Enzyme lab",
        type: "project",
        estimatedMinutes: 180,
        status: "not_started",
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

    const storedSession = await query(
      "SELECT user_id, duration_minutes FROM study_sessions WHERE id = $1",
      [getStudySession(response).id],
    );

    expect(storedSession.rows[0]).toMatchObject({
      user_id: student.user.id,
      duration_minutes: 75,
    });
  });

  it("returns 404 for another student's references and 400 for mismatched study block coursework", async () => {
    const student = await createTestStudent("attach-owner");
    const otherStudent = await createTestStudent("attach-other");
    const ownedCoursework = getCourseworkItem(
      await createCoursework(student.token, { title: "Owned task" }),
    );
    const otherCoursework = getCourseworkItem(
      await createCoursework(otherStudent.token, { title: "Private task" }),
    );
    const otherStudyBlock = await createStudyBlockForUser(
      otherStudent.user.id,
      otherCoursework.id,
    );
    const differentOwnedCoursework = getCourseworkItem(
      await createCoursework(student.token, { title: "Different task" }),
    );
    const mismatchedBlock = await createStudyBlockForUser(
      student.user.id,
      differentOwnedCoursework.id,
    );

    const courseworkResponse = await createStudySession(student.token, {
      courseworkId: otherCoursework.id,
    });
    const studyBlockResponse = await createStudySession(student.token, {
      studyBlockId: otherStudyBlock.id,
    });
    const mismatchResponse = await createStudySession(student.token, {
      courseworkId: ownedCoursework.id,
      studyBlockId: mismatchedBlock.id,
    });

    expect(courseworkResponse.status).toBe(404);
    expect(courseworkResponse.body.error.message).toBe(
      "Coursework item not found.",
    );
    expect(studyBlockResponse.status).toBe(404);
    expect(studyBlockResponse.body.error.message).toBe(
      "Study block not found.",
    );
    expect(mismatchResponse.status).toBe(400);
    expect(mismatchResponse.body.error.message).toBe(
      "Study block belongs to a different coursework item.",
    );
  });

  it("lists owned study sessions with filters", async () => {
    const student = await createTestStudent("filters-owner");
    const otherStudent = await createTestStudent("filters-other");
    const coursework = getCourseworkItem(
      await createCoursework(student.token, { title: "Filtered task" }),
    );
    const otherCoursework = getCourseworkItem(
      await createCoursework(student.token, { title: "Other task" }),
    );
    const studyBlock = await createStudyBlockForUser(
      student.user.id,
      coursework.id,
    );

    await createStudySession(student.token, {
      courseworkId: coursework.id,
      studyBlockId: studyBlock.id,
      source: "manual",
      startedAt: "2027-02-15T14:00:00.000Z",
      endedAt: "2027-02-15T15:00:00.000Z",
      durationMinutes: 60,
      notes: "Manual target",
    });
    await createStudySession(student.token, {
      courseworkId: otherCoursework.id,
      source: "timer",
      startedAt: "2027-02-16T14:00:00.000Z",
      endedAt: "2027-02-16T15:30:00.000Z",
      durationMinutes: 90,
      notes: "Timer other",
    });
    await createStudySession(student.token, {
      courseworkId: coursework.id,
      source: "manual",
      startedAt: "2027-03-01T14:00:00.000Z",
      endedAt: "2027-03-01T15:00:00.000Z",
      durationMinutes: 60,
      notes: "Outside range",
    });
    await createStudySession(otherStudent.token, {
      source: "manual",
      startedAt: "2027-02-15T14:00:00.000Z",
      endedAt: "2027-02-15T15:00:00.000Z",
      durationMinutes: 60,
      notes: "Private session",
    });

    const rangeResponse = await request(app)
      .get("/api/progress/study-sessions?from=2027-02-15&to=2027-02-16")
      .set("Authorization", "Bearer " + student.token);
    const courseworkResponse = await request(app)
      .get("/api/progress/study-sessions?courseworkId=" + coursework.id)
      .set("Authorization", "Bearer " + student.token);
    const studyBlockResponse = await request(app)
      .get("/api/progress/study-sessions?studyBlockId=" + studyBlock.id)
      .set("Authorization", "Bearer " + student.token);
    const sourceLimitResponse = await request(app)
      .get("/api/progress/study-sessions?source=manual&limit=1")
      .set("Authorization", "Bearer " + student.token);

    expect(rangeResponse.status).toBe(200);
    expect(
      rangeResponse.body.data.studySessions.map((item) => item.notes),
    ).toEqual(["Timer other", "Manual target"]);
    expect(
      courseworkResponse.body.data.studySessions.map((item) => item.notes),
    ).toEqual(["Outside range", "Manual target"]);
    expect(
      studyBlockResponse.body.data.studySessions.map((item) => item.notes),
    ).toEqual(["Manual target"]);
    expect(sourceLimitResponse.body.data.studySessions).toHaveLength(1);
    expect(sourceLimitResponse.body.data.studySessions[0].source).toBe(
      "manual",
    );
  });

  it("returns 404 for another student's study session", async () => {
    const student = await createTestStudent("private-owner");
    const otherStudent = await createTestStudent("private-other");
    const otherSession = getStudySession(
      await createStudySession(otherStudent.token, {
        notes: "Private session",
      }),
    );

    const getResponse = await request(app)
      .get("/api/progress/study-sessions/" + otherSession.id)
      .set("Authorization", "Bearer " + student.token);
    const patchResponse = await request(app)
      .patch("/api/progress/study-sessions/" + otherSession.id)
      .set("Authorization", "Bearer " + student.token)
      .send({ notes: "Changed" });
    const deleteResponse = await request(app)
      .delete("/api/progress/study-sessions/" + otherSession.id)
      .set("Authorization", "Bearer " + student.token);

    expect(getResponse.status).toBe(404);
    expect(patchResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);

    const ownerResponse = await request(app)
      .get("/api/progress/study-sessions/" + otherSession.id)
      .set("Authorization", "Bearer " + otherStudent.token);

    expect(ownerResponse.status).toBe(200);
    expect(getStudySession(ownerResponse).notes).toBe("Private session");
  });

  it("updates an owned study session and clears optional links", async () => {
    const student = await createTestStudent("update");
    const coursework = getCourseworkItem(
      await createCoursework(student.token, { title: "Original task" }),
    );
    const studyBlock = await createStudyBlockForUser(
      student.user.id,
      coursework.id,
    );
    const createdSession = getStudySession(
      await createStudySession(student.token, {
        courseworkId: coursework.id,
        studyBlockId: studyBlock.id,
      }),
    );

    const response = await request(app)
      .patch("/api/progress/study-sessions/" + createdSession.id)
      .set("Authorization", "Bearer " + student.token)
      .send({
        courseworkId: "",
        studyBlockId: null,
        source: "timer",
        startedAt: "2027-02-15T16:00:00.000Z",
        endedAt: "2027-02-15T17:30:00.000Z",
        durationMinutes: "90",
        notes: " ",
      });

    expect(response.status).toBe(200);
    expect(getStudySession(response)).toMatchObject({
      id: createdSession.id,
      courseworkId: null,
      studyBlockId: null,
      source: "timer",
      startedAt: "2027-02-15T16:00:00.000Z",
      endedAt: "2027-02-15T17:30:00.000Z",
      durationMinutes: 90,
      notes: null,
      coursework: null,
      studyBlock: null,
    });
  });

  it("returns 400 when an update would make timestamps invalid", async () => {
    const student = await createTestStudent("invalid-update-time");
    const createdSession = getStudySession(
      await createStudySession(student.token, {
        startedAt: "2027-02-15T14:00:00.000Z",
        endedAt: "2027-02-15T15:00:00.000Z",
      }),
    );

    const response = await request(app)
      .patch("/api/progress/study-sessions/" + createdSession.id)
      .set("Authorization", "Bearer " + student.token)
      .send({ endedAt: "2027-02-15T13:00:00.000Z" });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      "startedAt must be before endedAt.",
    );
  });

  it("computes progress summary metrics, study time, recent sessions, and estimate accuracy", async () => {
    const student = await createTestStudent("summary");
    const otherStudent = await createTestStudent("summary-other");
    const course = getCourse(
      await createCourse(student.token, { name: "Biology" }),
    );
    const otherCourse = getCourse(
      await createCourse(student.token, { name: "History" }),
    );

    const completedOne = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Completed one",
        estimatedMinutes: 100,
      }),
    );
    const completedTwo = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Completed two",
        estimatedMinutes: 200,
      }),
    );
    const missed = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Missed task",
      }),
    );
    const postponed = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Postponed task",
      }),
    );
    const openOne = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Open one",
      }),
    );
    const openTwo = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Open two",
      }),
    );
    const archived = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Archived task",
      }),
    );
    const outsideCoursework = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: course.id,
        title: "Outside task",
      }),
    );
    const otherCoursework = getCourseworkItem(
      await createCoursework(student.token, {
        courseId: otherCourse.id,
        title: "Other course task",
        estimatedMinutes: 10,
      }),
    );

    await updateStoredCoursework(completedOne.id, {
      status: "completed",
      completedAt: "2027-02-16T12:00:00.000Z",
      dueAt: "2027-02-16T22:00:00.000Z",
    });
    await updateStoredCoursework(completedTwo.id, {
      status: "completed",
      completedAt: "2027-02-17T12:00:00.000Z",
      dueAt: "2027-02-17T22:00:00.000Z",
    });
    await updateStoredCoursework(missed.id, {
      status: "missed",
      dueAt: "2027-02-18T22:00:00.000Z",
    });
    await updateStoredCoursework(postponed.id, {
      status: "postponed",
      dueAt: "2027-02-19T22:00:00.000Z",
    });
    await updateStoredCoursework(openOne.id, {
      status: "not_started",
      dueAt: "2027-02-20T22:00:00.000Z",
    });
    await updateStoredCoursework(openTwo.id, {
      status: "in_progress",
      dueAt: "2027-02-21T22:00:00.000Z",
    });
    await updateStoredCoursework(archived.id, {
      status: "archived",
      dueAt: "2027-02-20T22:00:00.000Z",
    });
    await updateStoredCoursework(outsideCoursework.id, {
      status: "completed",
      completedAt: "2027-03-01T12:00:00.000Z",
      dueAt: "2027-03-01T22:00:00.000Z",
    });
    await updateStoredCoursework(otherCoursework.id, {
      status: "completed",
      completedAt: "2027-02-16T12:00:00.000Z",
      dueAt: "2027-02-16T22:00:00.000Z",
    });

    await createStudySession(student.token, {
      courseworkId: completedOne.id,
      startedAt: "2027-02-16T13:00:00.000Z",
      endedAt: "2027-02-16T15:00:00.000Z",
      durationMinutes: 120,
      notes: "Completed one session",
    });
    await createStudySession(student.token, {
      courseworkId: completedTwo.id,
      startedAt: "2027-02-17T13:00:00.000Z",
      endedAt: "2027-02-17T16:40:00.000Z",
      durationMinutes: 220,
      notes: "Completed two session",
    });
    await createStudySession(student.token, {
      courseworkId: openTwo.id,
      startedAt: "2027-02-18T13:00:00.000Z",
      endedAt: "2027-02-18T14:15:00.000Z",
      durationMinutes: 75,
      notes: "Open session",
    });
    await createStudySession(student.token, {
      courseworkId: outsideCoursework.id,
      startedAt: "2027-03-01T13:00:00.000Z",
      endedAt: "2027-03-01T14:00:00.000Z",
      durationMinutes: 60,
      notes: "Outside session",
    });
    await createStudySession(otherStudent.token, {
      startedAt: "2027-02-16T13:00:00.000Z",
      endedAt: "2027-02-16T14:00:00.000Z",
      durationMinutes: 60,
      notes: "Private session",
    });

    const response = await request(app)
      .get(
        "/api/progress/summary?from=2027-02-15&to=2027-02-21&courseId=" +
          course.id,
      )
      .set("Authorization", "Bearer " + student.token);
    const otherCourseResponse = await request(app)
      .get(
        "/api/progress/summary?from=2027-02-15&to=2027-02-21&courseId=" +
          otherCourse.id,
      )
      .set("Authorization", "Bearer " + student.token);

    expect(response.status).toBe(200);
    expect(response.body.data.progress).toMatchObject({
      range: {
        from: "2027-02-15",
        to: "2027-02-21",
      },
      taskCounts: {
        completed: 2,
        missed: 1,
        postponed: 1,
        open: 2,
        totalDue: 6,
      },
      studyTime: {
        totalMinutes: 415,
        sessionCount: 3,
        averageSessionMinutes: 138,
      },
      estimateAccuracy: {
        label: "usually_close",
        comparedCourseworkCount: 2,
        averageEstimatedMinutes: 150,
        averageActualMinutes: 170,
        averageDeltaMinutes: 20,
      },
    });
    expect(
      response.body.data.progress.recentSessions.map((item) => item.notes),
    ).toEqual([
      "Open session",
      "Completed two session",
      "Completed one session",
    ]);
    expect(otherCourseResponse.body.data.progress.taskCounts.completed).toBe(1);
    expect(otherCourseResponse.body.data.progress.studyTime.totalMinutes).toBe(
      0,
    );
    expect(otherCourseResponse.body.data.progress.estimateAccuracy.label).toBe(
      "not_enough_data",
    );
  });

  it("returns an empty default-week summary when no progress exists", async () => {
    const student = await createTestStudent("empty-summary");

    const response = await request(app)
      .get("/api/progress/summary")
      .set("Authorization", "Bearer " + student.token);

    expect(response.status).toBe(200);
    expect(response.body.data.progress.range).toMatchObject({
      from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(response.body.data.progress.taskCounts).toEqual({
      completed: 0,
      missed: 0,
      postponed: 0,
      open: 0,
      totalDue: 0,
    });
    expect(response.body.data.progress.studyTime).toEqual({
      totalMinutes: 0,
      sessionCount: 0,
      averageSessionMinutes: 0,
    });
    expect(response.body.data.progress.estimateAccuracy).toMatchObject({
      label: "not_enough_data",
      comparedCourseworkCount: 0,
    });
    expect(response.body.data.progress.recentSessions).toEqual([]);
  });

  it("deletes one owned study session", async () => {
    const student = await createTestStudent("delete");
    const createdSession = getStudySession(
      await createStudySession(student.token, { notes: "Delete session" }),
    );

    const deleteResponse = await request(app)
      .delete("/api/progress/study-sessions/" + createdSession.id)
      .set("Authorization", "Bearer " + student.token);
    const getResponse = await request(app)
      .get("/api/progress/study-sessions/" + createdSession.id)
      .set("Authorization", "Bearer " + student.token);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.text).toBe("");
    expect(getResponse.status).toBe(404);
  });
});
