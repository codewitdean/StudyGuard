import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-12b-study-plan-routes-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "study-plan-test-%@example.com";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
}

async function createTestStudent(label = "student", planningPriority) {
  const email = "study-plan-test-" + label + "@example.com";
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Study Plan " + label,
      email,
      password: "correct-password",
    });

  if (planningPriority) {
    await query("UPDATE users SET planning_priority = $1 WHERE id = $2", [
      planningPriority,
      response.body.data.user.id,
    ]);
  }

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
      estimatedMinutes: 60,
      ...body,
    });
}

async function updateCoursework(token, courseworkId, body) {
  return request(app)
    .patch("/api/coursework/" + courseworkId)
    .set("Authorization", "Bearer " + token)
    .send(body);
}

async function createWeeklyAvailability(token, body = {}) {
  return request(app)
    .post("/api/availability/weekly")
    .set("Authorization", "Bearer " + token)
    .send({
      weekday: 1,
      startTime: "09:00",
      endTime: "12:00",
      label: "Morning study",
      ...body,
    });
}

async function createAvailabilityException(token, body = {}) {
  return request(app)
    .post("/api/availability/exceptions")
    .set("Authorization", "Bearer " + token)
    .send({
      exceptionDate: "2027-02-15",
      type: "unavailable",
      isFullDay: true,
      ...body,
    });
}

async function generateStudyPlan(token, body = {}) {
  return request(app)
    .post("/api/study-plans/generate")
    .set("Authorization", "Bearer " + token)
    .send(body);
}

function getCourseworkItem(response) {
  return response.body.data.courseworkItem;
}

function getStudyPlan(response) {
  return response.body.data.studyPlan;
}

function localIso(dateString, timeString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = timeString.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
}

function getDateSpanDays(startDate, endDate) {
  return (
    (new Date(endDate + "T00:00:00.000Z").getTime() -
      new Date(startDate + "T00:00:00.000Z").getTime()) /
      86400000 +
    1
  );
}

function getLocalDateTimeParts(value) {
  const date = new Date(value);
  return {
    date: [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-"),
    minutes: date.getHours() * 60 + date.getMinutes(),
  };
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

describe("/api/study-plans", () => {
  it("requires authentication for listing and generation", async () => {
    const listResponse = await request(app).get("/api/study-plans");
    const generateResponse = await request(app)
      .post("/api/study-plans/generate")
      .send({});

    expect(listResponse.status).toBe(401);
    expect(listResponse.body.error.message).toBe("Authentication required.");
    expect(generateResponse.status).toBe(401);
    expect(generateResponse.body.error.message).toBe(
      "Authentication required.",
    );
  });

  it("returns 400 for invalid generation and list inputs", async () => {
    const student = await createTestStudent("invalid-input");

    const invalidDateResponse = await generateStudyPlan(student.token, {
      startDate: "not-a-date",
    });
    const reversedRangeResponse = await generateStudyPlan(student.token, {
      startDate: "2027-02-20",
      endDate: "2027-02-15",
    });
    const longRangeResponse = await generateStudyPlan(student.token, {
      startDate: "2027-02-01",
      endDate: "2027-03-10",
    });
    const invalidListResponse = await request(app)
      .get("/api/study-plans?status=done")
      .set("Authorization", "Bearer " + student.token);

    expect(invalidDateResponse.status).toBe(400);
    expect(invalidDateResponse.body.error.message).toBe("Validation failed.");
    expect(reversedRangeResponse.status).toBe(400);
    expect(longRangeResponse.status).toBe(400);
    expect(invalidListResponse.status).toBe(400);
  });

  it("defaults generation to a seven-day draft using the saved planning priority", async () => {
    const student = await createTestStudent("default-range", "prevent_burnout");

    const response = await generateStudyPlan(student.token);

    expect(response.status).toBe(201);
    expect(getStudyPlan(response)).toMatchObject({
      status: "draft",
      planningPriority: "prevent_burnout",
      overloadStatus: "balanced",
    });
    expect(
      getDateSpanDays(
        getStudyPlan(response).planStartDate,
        getStudyPlan(response).planEndDate,
      ),
    ).toBe(7);
  });

  it("generates a draft plan with owner-scoped study blocks", async () => {
    const student = await createTestStudent("generate-owner", "meet_deadlines");
    const courseResponse = await createCourse(student.token, {
      name: "Biology",
    });
    const course = courseResponse.body.data.course;
    await createWeeklyAvailability(student.token);
    const courseworkResponse = await createCoursework(student.token, {
      courseId: course.id,
      dueAt: localIso("2027-02-16", "18:00"),
      priority: "high",
      difficulty: "hard",
      estimatedMinutes: 60,
    });
    const coursework = getCourseworkItem(courseworkResponse);

    const response = await generateStudyPlan(student.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-21",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.studyBlocks).toHaveLength(1);
    expect(response.body.data.studyBlocks[0]).toMatchObject({
      courseworkId: coursework.id,
      coursework: {
        id: coursework.id,
        title: "Biology lab report",
        course: {
          id: course.id,
          name: "Biology",
        },
      },
      blockType: "study",
      status: "planned",
    });
    expect(response.body.data.summary).toMatchObject({
      availableMinutes: 180,
      requiredMinutes: 60,
      scheduledMinutes: 60,
      unscheduledMinutes: 0,
      overloadStatus: "balanced",
    });

    const storedBlocks = await query(
      "SELECT user_id, study_plan_id, coursework_id FROM study_blocks WHERE study_plan_id = $1",
      [getStudyPlan(response).id],
    );

    expect(storedBlocks.rows).toHaveLength(1);
    expect(storedBlocks.rows[0].user_id).toBe(student.user.id);
    expect(storedBlocks.rows[0].coursework_id).toBe(coursework.id);
  });

  it("excludes closed and other-student coursework while returning custom-priority warnings", async () => {
    const student = await createTestStudent("exclude-owner");
    const otherStudent = await createTestStudent("exclude-other");
    await createWeeklyAvailability(student.token);
    const openCoursework = await createCoursework(student.token, {
      title: "Open work",
      estimatedMinutes: 60,
    });
    const completedCoursework = await createCoursework(student.token, {
      title: "Completed work",
      estimatedMinutes: 60,
    });
    const archivedCoursework = await createCoursework(student.token, {
      title: "Archived work",
      estimatedMinutes: 60,
    });
    await updateCoursework(
      student.token,
      getCourseworkItem(completedCoursework).id,
      { status: "completed" },
    );
    await updateCoursework(
      student.token,
      getCourseworkItem(archivedCoursework).id,
      {
        status: "archived",
      },
    );
    await createCoursework(otherStudent.token, {
      title: "Other work",
      estimatedMinutes: 60,
    });

    const response = await generateStudyPlan(student.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-21",
      planningPriority: "custom",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.studyBlocks).toHaveLength(1);
    expect(response.body.data.studyBlocks[0].courseworkId).toBe(
      getCourseworkItem(openCoursework).id,
    );
    expect(response.body.data.summary.requiredMinutes).toBe(60);
    expect(
      response.body.data.warnings.map((warning) => warning.code),
    ).toContain("custom_priority_not_configured");
  });

  it("returns no blocks and a no-availability warning for full-day unavailable exceptions", async () => {
    const student = await createTestStudent("full-day-unavailable");
    await createWeeklyAvailability(student.token);
    await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-15",
      type: "unavailable",
      isFullDay: true,
      startTime: undefined,
      endTime: undefined,
    });
    await createCoursework(student.token, {
      dueAt: localIso("2027-02-15", "18:00"),
      estimatedMinutes: 60,
    });

    const response = await generateStudyPlan(student.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-15",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.studyBlocks).toHaveLength(0);
    expect(response.body.data.summary).toMatchObject({
      availableMinutes: 0,
      requiredMinutes: 60,
      scheduledMinutes: 0,
      unscheduledMinutes: 60,
      overloadStatus: "overloaded",
    });
    expect(
      response.body.data.warnings.map((warning) => warning.code),
    ).toContain("no_availability");
  });

  it("applies partial unavailable and extra-available exceptions", async () => {
    const student = await createTestStudent("partial-and-extra");
    await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "09:00",
      endTime: "12:00",
    });
    await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-15",
      type: "unavailable",
      isFullDay: false,
      startTime: "10:00",
      endTime: "11:00",
    });
    await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-17",
      type: "extra_available",
      isFullDay: false,
      startTime: "15:00",
      endTime: "16:00",
    });
    await createCoursework(student.token, {
      title: "Large reading",
      type: "reading",
      estimatedMinutes: 240,
    });

    const response = await generateStudyPlan(student.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-17",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.summary).toMatchObject({
      availableMinutes: 180,
      scheduledMinutes: 180,
      unscheduledMinutes: 60,
      overloadStatus: "overloaded",
    });
    expect(
      response.body.data.warnings.map((warning) => warning.code),
    ).toContain("insufficient_availability");

    for (const block of response.body.data.studyBlocks) {
      const start = getLocalDateTimeParts(block.startAt);
      const end = getLocalDateTimeParts(block.endAt);

      if (start.date === "2027-02-15") {
        expect(start.minutes < 11 * 60 && end.minutes > 10 * 60).toBe(false);
      }
    }
  });

  it("does not schedule blocks after a coursework due date", async () => {
    const student = await createTestStudent("before-due");
    await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "09:00",
      endTime: "12:00",
    });
    const dueAt = localIso("2027-02-15", "10:30");
    await createCoursework(student.token, {
      dueAt,
      estimatedMinutes: 180,
    });

    const response = await generateStudyPlan(student.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-15",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.summary).toMatchObject({
      scheduledMinutes: 90,
      unscheduledMinutes: 90,
    });
    expect(response.body.data.studyBlocks).not.toHaveLength(0);

    for (const block of response.body.data.studyBlocks) {
      expect(new Date(block.endAt).getTime()).toBeLessThanOrEqual(
        new Date(dueAt).getTime(),
      );
    }
  });

  it("lists and gets only owned study plans", async () => {
    const student = await createTestStudent("list-owner");
    const otherStudent = await createTestStudent("list-other");
    const studentPlan = await generateStudyPlan(student.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-21",
    });
    const otherPlan = await generateStudyPlan(otherStudent.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-21",
    });

    const listResponse = await request(app)
      .get("/api/study-plans?status=current&from=2027-02-16&to=2027-02-20")
      .set("Authorization", "Bearer " + student.token);
    const getResponse = await request(app)
      .get("/api/study-plans/" + getStudyPlan(studentPlan).id)
      .set("Authorization", "Bearer " + student.token);
    const otherGetResponse = await request(app)
      .get("/api/study-plans/" + getStudyPlan(otherPlan).id)
      .set("Authorization", "Bearer " + student.token);
    const invalidIdResponse = await request(app)
      .get("/api/study-plans/not-a-uuid")
      .set("Authorization", "Bearer " + student.token);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.studyPlans.map((plan) => plan.id)).toEqual([
      getStudyPlan(studentPlan).id,
    ]);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.studyPlan.id).toBe(
      getStudyPlan(studentPlan).id,
    );
    expect(otherGetResponse.status).toBe(404);
    expect(otherGetResponse.body.error.message).toBe("Study plan not found.");
    expect(invalidIdResponse.status).toBe(400);
  });

  it("approves draft plans and archives overlapping active plans", async () => {
    const student = await createTestStudent("approve-overlap");
    const firstPlan = await generateStudyPlan(student.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-21",
    });
    const firstPlanId = getStudyPlan(firstPlan).id;
    const firstApproveResponse = await request(app)
      .post("/api/study-plans/" + firstPlanId + "/approve")
      .set("Authorization", "Bearer " + student.token);
    const secondPlan = await generateStudyPlan(student.token, {
      startDate: "2027-02-16",
      endDate: "2027-02-22",
    });
    const secondPlanId = getStudyPlan(secondPlan).id;
    const secondApproveResponse = await request(app)
      .post("/api/study-plans/" + secondPlanId + "/approve")
      .set("Authorization", "Bearer " + student.token);
    const repeatApproveResponse = await request(app)
      .post("/api/study-plans/" + secondPlanId + "/approve")
      .set("Authorization", "Bearer " + student.token);

    expect(firstApproveResponse.status).toBe(200);
    expect(firstApproveResponse.body.data.studyPlan).toMatchObject({
      id: firstPlanId,
      status: "active",
    });
    expect(firstApproveResponse.body.data.studyPlan.approvedAt).toEqual(
      expect.any(String),
    );
    expect(secondApproveResponse.status).toBe(200);
    expect(secondApproveResponse.body.data.studyPlan.status).toBe("active");
    expect(repeatApproveResponse.status).toBe(409);
    expect(repeatApproveResponse.body.error.message).toBe(
      "Only draft study plans can be approved.",
    );

    const plans = await query(
      "SELECT id, status FROM study_plans WHERE id IN ($1, $2) ORDER BY id",
      [firstPlanId, secondPlanId],
    );
    const statusesById = Object.fromEntries(
      plans.rows.map((plan) => [plan.id, plan.status]),
    );

    expect(statusesById[firstPlanId]).toBe("archived");
    expect(statusesById[secondPlanId]).toBe("active");
  });

  it("archives owned plans and rejects duplicate archive requests", async () => {
    const student = await createTestStudent("archive-plan");
    const planResponse = await generateStudyPlan(student.token, {
      startDate: "2027-02-15",
      endDate: "2027-02-21",
    });
    const studyPlanId = getStudyPlan(planResponse).id;

    const archiveResponse = await request(app)
      .post("/api/study-plans/" + studyPlanId + "/archive")
      .set("Authorization", "Bearer " + student.token);
    const repeatArchiveResponse = await request(app)
      .post("/api/study-plans/" + studyPlanId + "/archive")
      .set("Authorization", "Bearer " + student.token);

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.data.studyPlan).toMatchObject({
      id: studyPlanId,
      status: "archived",
    });
    expect(repeatArchiveResponse.status).toBe(409);
    expect(repeatArchiveResponse.body.error.message).toBe(
      "Study plan is already archived.",
    );
  });
});
