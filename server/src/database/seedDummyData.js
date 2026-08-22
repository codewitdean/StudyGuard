import "dotenv/config";
import { closeDatabase, query, transaction } from "./db.js";
import {
  approveStudyPlanForUser,
  generateStudyPlanForUser,
} from "../services/studyPlanService.js";
import { hashPassword } from "../utils/passwords.js";

const demoUser = {
  name: "Demo Student",
  email: "student.demo@studyguard.local",
  password: "StudyGuardDemo123!",
  planningPriority: "balance_deadlines_wellbeing",
};

function toLocalDateString(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

function getCurrentWeekMonday(dateString) {
  const date = new Date(dateString + "T00:00:00");
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(dateString, -mondayOffset);
}

function atTime(dateString, time) {
  return dateString + "T" + time + ":00";
}

function getCourseSeedData() {
  return [
    {
      key: "psychology",
      name: "Cognitive Psychology",
      code: "PSYC 210",
      instructor: "Dr. Ada Nguyen",
      color: "#2563eb",
      term: "Fall 2026",
      targetGrade: "A-",
    },
    {
      key: "dataStructures",
      name: "Data Structures",
      code: "CS 242",
      instructor: "Prof. Marcus Lee",
      color: "#16a34a",
      term: "Fall 2026",
      targetGrade: "B+",
    },
    {
      key: "statistics",
      name: "Statistics Lab",
      code: "STAT 204",
      instructor: "Dr. Priya Shah",
      color: "#f97316",
      term: "Fall 2026",
      targetGrade: "A",
    },
    {
      key: "writing",
      name: "Academic Writing Seminar",
      code: "WRIT 150",
      instructor: "Prof. Elena Brooks",
      color: "#9333ea",
      term: "Fall 2026",
      targetGrade: "A-",
    },
    {
      key: "summerAlgorithms",
      name: "Algorithms Intensive",
      code: "CS 310",
      instructor: "Dr. Naomi Reed",
      color: "#0f766e",
      term: "Summer 2026",
      targetGrade: "A-",
      isArchived: true,
    },
    {
      key: "summerResearchWriting",
      name: "Research Writing Studio",
      code: "WRIT 240",
      instructor: "Prof. Daniel Ortiz",
      color: "#7c3aed",
      term: "Summer 2026",
      targetGrade: "A",
      isArchived: true,
    },
    {
      key: "archivedHistory",
      name: "Modern World History",
      code: "HIST 101",
      instructor: "Dr. Sam Carter",
      color: "#64748b",
      term: "Spring 2026",
      targetGrade: "B",
      isArchived: true,
    },
  ];
}

function getWeeklyAvailabilitySeedData() {
  return [
    {
      weekday: 1,
      startTime: "09:00",
      endTime: "11:00",
      label: "Morning library block",
    },
    {
      weekday: 1,
      startTime: "18:00",
      endTime: "20:00",
      label: "Evening review",
    },
    {
      weekday: 2,
      startTime: "14:00",
      endTime: "17:00",
      label: "Open campus time",
    },
    {
      weekday: 3,
      startTime: "10:00",
      endTime: "12:00",
      label: "Before lab",
    },
    {
      weekday: 3,
      startTime: "19:00",
      endTime: "21:00",
      label: "Quiet evening focus",
    },
    {
      weekday: 4,
      startTime: "15:00",
      endTime: "18:00",
      label: "Afternoon deep work",
    },
    {
      weekday: 5,
      startTime: "09:00",
      endTime: "10:30",
      label: "Friday checkpoint",
    },
    {
      weekday: 6,
      startTime: "11:00",
      endTime: "15:00",
      label: "Weekend study sprint",
    },
    {
      weekday: 7,
      startTime: "16:00",
      endTime: "18:00",
      label: "Sunday reset",
    },
  ];
}

function getAvailabilityExceptionSeedData(today) {
  return [
    {
      exceptionDate: addDays(today, 2),
      type: "extra_available",
      isFullDay: false,
      startTime: "09:00",
      endTime: "12:00",
      reason: "Library study sprint before the next deadline.",
    },
    {
      exceptionDate: addDays(today, 4),
      type: "unavailable",
      isFullDay: true,
      startTime: null,
      endTime: null,
      reason: "Family commitment.",
    },
    {
      exceptionDate: addDays(today, 6),
      type: "extra_available",
      isFullDay: false,
      startTime: "14:00",
      endTime: "17:00",
      reason: "Catch-up block before the week ends.",
    },
  ];
}

function getCourseworkSeedData(today) {
  return [
    {
      key: "psychReflection",
      courseKey: "psychology",
      title: "Memory Reflection Journal",
      description:
        "Connect the working-memory reading to one real study habit and one class example.",
      type: "assignment",
      dueAt: atTime(today, "22:00"),
      priority: "high",
      difficulty: "medium",
      estimatedMinutes: 120,
      status: "not_started",
      gradeWeight: 8,
      topic: "Working memory",
      notes: "Good task for testing due-today dashboard behavior.",
    },
    {
      key: "graphTraversal",
      courseKey: "dataStructures",
      title: "Problem Set 4: Graph Traversal",
      description:
        "Implement breadth-first search, depth-first search, and short explanations for edge cases.",
      type: "assignment",
      dueAt: atTime(addDays(today, 1), "23:59"),
      priority: "urgent",
      difficulty: "very_hard",
      estimatedMinutes: 240,
      status: "in_progress",
      gradeWeight: 12.5,
      topic: "Graphs",
      notes:
        "Intentionally high effort and urgent for recommendations testing.",
    },
    {
      key: "statsRegression",
      courseKey: "statistics",
      title: "Regression Lab Report",
      description:
        "Clean the dataset, run the regression model, and explain two surprising coefficients.",
      type: "project",
      dueAt: atTime(addDays(today, 3), "17:00"),
      priority: "high",
      difficulty: "hard",
      estimatedMinutes: 180,
      status: "in_progress",
      gradeWeight: 15,
      topic: "Linear regression",
      notes: "Useful for testing study plan blocks and progress filters.",
    },
    {
      key: "writingBibliography",
      courseKey: "writing",
      title: "Annotated Bibliography",
      description:
        "Summarize six credible sources and identify how each source supports the essay argument.",
      type: "assignment",
      dueAt: atTime(addDays(today, 5), "23:59"),
      priority: "medium",
      difficulty: "medium",
      estimatedMinutes: 150,
      status: "not_started",
      gradeWeight: 10,
      topic: "Research sources",
      notes: "Medium priority item for schedule ordering checks.",
    },
    {
      key: "finalReview",
      courseKey: "psychology",
      title: "Final Exam Review Plan",
      description:
        "Build a review outline, identify weak topics, and schedule spaced retrieval practice.",
      type: "exam",
      dueAt: atTime(addDays(today, 7), "09:00"),
      priority: "urgent",
      difficulty: "hard",
      estimatedMinutes: 300,
      status: "not_started",
      gradeWeight: 25,
      topic: "Exam prep",
      notes: "Large item to test heavy workload summaries.",
    },
    {
      key: "datasetNotebook",
      courseKey: "statistics",
      title: "Dataset Cleaning Notebook",
      description:
        "Document missing values, outliers, and feature transformations for the final project dataset.",
      type: "project",
      dueAt: atTime(addDays(today, 10), "20:00"),
      priority: "medium",
      difficulty: "hard",
      estimatedMinutes: 160,
      status: "postponed",
      gradeWeight: 10,
      topic: "Data cleaning",
      notes: "Postponed item for status filters.",
    },
    {
      key: "fairnessReading",
      courseKey: "dataStructures",
      title: "Reading: Algorithmic Fairness",
      description:
        "Read the assigned article and capture three discussion questions for seminar.",
      type: "reading",
      dueAt: null,
      priority: "low",
      difficulty: "easy",
      estimatedMinutes: 75,
      status: "not_started",
      gradeWeight: null,
      topic: "Ethics",
      notes: "No due date item for coursework filters.",
    },
    {
      key: "officeHoursQuestions",
      courseKey: null,
      title: "Prepare Office Hours Questions",
      description:
        "Collect blockers from each class and turn them into specific questions for instructors.",
      type: "study_task",
      dueAt: atTime(addDays(today, 2), "13:00"),
      priority: "low",
      difficulty: "easy",
      estimatedMinutes: 30,
      status: "not_started",
      gradeWeight: null,
      topic: "Planning",
      notes: "No-course item for null course rendering.",
    },
    {
      key: "peerReview",
      courseKey: "writing",
      title: "Essay Draft Peer Review",
      description:
        "Review two classmate drafts and submit comments in the course portal.",
      type: "assignment",
      dueAt: atTime(addDays(today, -1), "15:00"),
      priority: "high",
      difficulty: "medium",
      estimatedMinutes: 90,
      status: "missed",
      gradeWeight: 5,
      topic: "Peer feedback",
      notes: "Overdue missed item for dashboard and coursework filters.",
    },
    {
      key: "quizCorrections",
      courseKey: "statistics",
      title: "Quiz 3 Corrections",
      description:
        "Correct missed probability questions and explain the fixed reasoning.",
      type: "quiz",
      dueAt: atTime(addDays(today, -2), "10:00"),
      priority: "medium",
      difficulty: "easy",
      estimatedMinutes: 60,
      status: "completed",
      gradeWeight: 5,
      topic: "Probability",
      notes: "Completed item for progress accuracy.",
      completedAt: atTime(addDays(today, -1), "18:00"),
    },
    {
      key: "unitTestRefactor",
      courseKey: "dataStructures",
      title: "Unit Test Refactor Practice",
      description:
        "Refactor old practice tests and add edge-case coverage for list operations.",
      type: "study_task",
      dueAt: atTime(today, "12:00"),
      priority: "medium",
      difficulty: "medium",
      estimatedMinutes: 90,
      status: "completed",
      gradeWeight: null,
      topic: "Testing",
      notes: "Completed today to exercise current-week progress counts.",
      completedAt: atTime(today, "11:15"),
    },
  ];
}

function getSummerCourseworkSeedData() {
  return [
    {
      key: "summerAlgorithmsQuiz",
      courseKey: "summerAlgorithms",
      title: "Quiz 1: Algorithm Analysis",
      description:
        "Completed summer quiz covering Big O and recurrence basics.",
      type: "quiz",
      dueAt: atTime("2026-06-08", "23:59"),
      priority: "medium",
      difficulty: "medium",
      estimatedMinutes: 60,
      status: "completed",
      gradeWeight: 10,
      topic: "Big O",
      notes:
        "Summer baseline item for syllabus extraction and weekly grouping checks.",
      completedAt: atTime("2026-06-08", "20:30"),
    },
    {
      key: "summerMemoDraft",
      courseKey: "summerResearchWriting",
      title: "Research Memo Draft",
      description: "Completed first summer research memo draft.",
      type: "assignment",
      dueAt: atTime("2026-06-15", "17:00"),
      priority: "high",
      difficulty: "medium",
      estimatedMinutes: 150,
      status: "completed",
      gradeWeight: 15,
      topic: "Research memo",
      notes: "Known completed writing task for summer-to-fall QA comparisons.",
      completedAt: atTime("2026-06-15", "15:45"),
    },
    {
      key: "summerDynamicProgrammingProject",
      courseKey: "summerAlgorithms",
      title: "Dynamic Programming Project",
      description:
        "Completed implementation and explanation for dynamic programming practice.",
      type: "project",
      dueAt: atTime("2026-07-02", "23:59"),
      priority: "high",
      difficulty: "hard",
      estimatedMinutes: 240,
      status: "completed",
      gradeWeight: 20,
      topic: "Dynamic programming",
      notes: "Large completed summer task for workload calibration.",
      completedAt: atTime("2026-07-02", "21:20"),
    },
    {
      key: "summerAnnotatedSources",
      courseKey: "summerResearchWriting",
      title: "Annotated Source Set",
      description: "Completed annotated source packet for final summer paper.",
      type: "assignment",
      dueAt: atTime("2026-07-13", "12:00"),
      priority: "medium",
      difficulty: "medium",
      estimatedMinutes: 120,
      status: "completed",
      gradeWeight: 15,
      topic: "Sources",
      notes: "Mid-summer completed coursework for weekly grouping validation.",
      completedAt: atTime("2026-07-13", "10:45"),
    },
    {
      key: "summerFinalExam",
      courseKey: "summerAlgorithms",
      title: "Final Exam: Algorithms Intensive",
      description: "Completed cumulative summer algorithms final exam.",
      type: "exam",
      dueAt: atTime("2026-08-01", "09:00"),
      priority: "urgent",
      difficulty: "hard",
      estimatedMinutes: 300,
      status: "completed",
      gradeWeight: 30,
      topic: "Final exam",
      notes: "Final completed summer assessment for fall planning calibration.",
      completedAt: atTime("2026-08-01", "11:30"),
    },
    {
      key: "summerFinalPaper",
      courseKey: "summerResearchWriting",
      title: "Final Research Paper",
      description: "Completed final paper for the summer writing course.",
      type: "project",
      dueAt: atTime("2026-08-05", "23:59"),
      priority: "urgent",
      difficulty: "hard",
      estimatedMinutes: 360,
      status: "completed",
      gradeWeight: 35,
      topic: "Final paper",
      notes: "Capstone writing item for historical workload comparison.",
      completedAt: atTime("2026-08-05", "22:10"),
    },
  ];
}

function getSummerSessionSeedData(courseworkIds) {
  return [
    {
      courseworkId: courseworkIds.summerAlgorithmsQuiz,
      source: "manual",
      startedAt: atTime("2026-06-08", "19:15"),
      endedAt: atTime("2026-06-08", "20:15"),
      durationMinutes: 60,
      notes: "Completed quiz review before submitting.",
    },
    {
      courseworkId: courseworkIds.summerMemoDraft,
      source: "timer",
      startedAt: atTime("2026-06-14", "14:00"),
      endedAt: atTime("2026-06-14", "16:30"),
      durationMinutes: 150,
      notes: "Drafted and revised research memo.",
    },
    {
      courseworkId: courseworkIds.summerDynamicProgrammingProject,
      source: "timer",
      startedAt: atTime("2026-06-30", "18:00"),
      endedAt: atTime("2026-06-30", "20:00"),
      durationMinutes: 120,
      notes: "Built first dynamic programming implementation pass.",
    },
    {
      courseworkId: courseworkIds.summerDynamicProgrammingProject,
      source: "manual",
      startedAt: atTime("2026-07-02", "19:00"),
      endedAt: atTime("2026-07-02", "21:00"),
      durationMinutes: 120,
      notes: "Finished explanation and final checks.",
    },
    {
      courseworkId: courseworkIds.summerAnnotatedSources,
      source: "manual",
      startedAt: atTime("2026-07-12", "10:00"),
      endedAt: atTime("2026-07-12", "12:00"),
      durationMinutes: 120,
      notes: "Annotated source set for final paper.",
    },
    {
      courseworkId: courseworkIds.summerFinalExam,
      source: "timer",
      startedAt: atTime("2026-07-31", "18:00"),
      endedAt: atTime("2026-07-31", "21:00"),
      durationMinutes: 180,
      notes: "Final exam review block.",
    },
    {
      courseworkId: courseworkIds.summerFinalPaper,
      source: "timer",
      startedAt: atTime("2026-08-04", "17:30"),
      endedAt: atTime("2026-08-04", "20:30"),
      durationMinutes: 180,
      notes: "Final paper revision session.",
    },
    {
      courseworkId: courseworkIds.summerFinalPaper,
      source: "manual",
      startedAt: atTime("2026-08-05", "20:00"),
      endedAt: atTime("2026-08-05", "22:00"),
      durationMinutes: 120,
      notes: "Final paper citations and submission checks.",
    },
  ];
}

function getSummerGradeSeedData(courseIds, courseworkIds) {
  return [
    {
      courseId: courseIds.summerAlgorithms,
      courseworkId: courseworkIds.summerAlgorithmsQuiz,
      assessmentType: "quiz",
      score: 9,
      maxScore: 10,
      gradeWeight: 10,
      topic: "Big O",
      isUnusual: false,
      notes: "Completed summer quiz baseline.",
      gradedAt: "2026-06-09",
    },
    {
      courseId: courseIds.summerResearchWriting,
      courseworkId: courseworkIds.summerMemoDraft,
      assessmentType: "assignment",
      score: 92,
      maxScore: 100,
      gradeWeight: 15,
      topic: "Research memo",
      isUnusual: false,
      notes: "Writing baseline for fall estimates.",
      gradedAt: "2026-06-18",
    },
    {
      courseId: courseIds.summerAlgorithms,
      courseworkId: courseworkIds.summerDynamicProgrammingProject,
      assessmentType: "project",
      score: 94,
      maxScore: 100,
      gradeWeight: 20,
      topic: "Dynamic programming",
      isUnusual: false,
      notes: "Large project completed close to estimate.",
      gradedAt: "2026-07-05",
    },
    {
      courseId: courseIds.summerResearchWriting,
      courseworkId: courseworkIds.summerAnnotatedSources,
      assessmentType: "assignment",
      score: 47,
      maxScore: 50,
      gradeWeight: 15,
      topic: "Sources",
      isUnusual: false,
      notes: "Source work completed on schedule.",
      gradedAt: "2026-07-15",
    },
    {
      courseId: courseIds.summerAlgorithms,
      courseworkId: courseworkIds.summerFinalExam,
      assessmentType: "exam",
      score: 88,
      maxScore: 100,
      gradeWeight: 30,
      topic: "Final exam",
      isUnusual: false,
      notes: "Final exam baseline for future planning intensity.",
      gradedAt: "2026-08-02",
    },
    {
      courseId: courseIds.summerResearchWriting,
      courseworkId: courseworkIds.summerFinalPaper,
      assessmentType: "project",
      score: 96,
      maxScore: 100,
      gradeWeight: 35,
      topic: "Final paper",
      isUnusual: false,
      notes: "Known final paper outcome for fall comparison.",
      gradedAt: "2026-08-07",
    },
  ];
}

function getSummerCheckInSeedData() {
  return [
    {
      checkInDate: "2026-06-15",
      energyLevel: 4,
      stressLevel: 3,
      focusLevel: 4,
      note: "Summer memo week felt manageable with one deep-work block.",
    },
    {
      checkInDate: "2026-07-02",
      energyLevel: 3,
      stressLevel: 4,
      focusLevel: 4,
      note: "Project week was heavier than estimated but still completed on time.",
    },
    {
      checkInDate: "2026-08-05",
      energyLevel: 4,
      stressLevel: 3,
      focusLevel: 5,
      note: "Summer semester completed and ready to use as fall calibration data.",
    },
  ];
}

function getUniqueCheckIns(today) {
  const monday = getCurrentWeekMonday(today);
  const entriesByDate = new Map(
    [
      {
        checkInDate: monday,
        energyLevel: 3,
        stressLevel: 4,
        focusLevel: 3,
        note: "A little overloaded, but the plan feels clear.",
      },
      {
        checkInDate: addDays(monday, 2),
        energyLevel: 4,
        stressLevel: 3,
        focusLevel: 4,
        note: "Good focus after splitting the statistics lab into pieces.",
      },
      {
        checkInDate: today,
        energyLevel: 4,
        stressLevel: 2,
        focusLevel: 5,
        note: "API is working and manual QA can continue.",
      },
    ].map((entry) => [entry.checkInDate, entry]),
  );

  return [...entriesByDate.values()];
}

function getSessionSeedData(today, courseworkIds, studyBlockForCoursework) {
  const monday = getCurrentWeekMonday(today);

  return [
    {
      courseworkId: courseworkIds.quizCorrections,
      studyBlockId: null,
      source: "manual",
      startedAt: atTime(addDays(today, -1), "17:00"),
      endedAt: atTime(addDays(today, -1), "17:45"),
      durationMinutes: 45,
      notes:
        "Reviewed missed probability questions and rewrote the solution steps.",
    },
    {
      courseworkId: courseworkIds.unitTestRefactor,
      studyBlockId: null,
      source: "timer",
      startedAt: atTime(today, "09:20"),
      endedAt: atTime(today, "10:05"),
      durationMinutes: 45,
      notes: "Timer session for linked-list edge cases.",
    },
    {
      courseworkId: courseworkIds.unitTestRefactor,
      studyBlockId: null,
      source: "manual",
      startedAt: atTime(today, "10:20"),
      endedAt: atTime(today, "11:10"),
      durationMinutes: 50,
      notes: "Finished refactor notes and marked the task complete.",
    },
    {
      courseworkId: courseworkIds.statsRegression,
      studyBlockId: studyBlockForCoursework(courseworkIds.statsRegression),
      source: "timer",
      startedAt: atTime(addDays(today, -2), "19:00"),
      endedAt: atTime(addDays(today, -2), "20:30"),
      durationMinutes: 90,
      notes: "Cleaned variables and reran the regression model.",
    },
    {
      courseworkId: courseworkIds.graphTraversal,
      studyBlockId: studyBlockForCoursework(courseworkIds.graphTraversal),
      source: "manual",
      startedAt: atTime(addDays(today, -1), "20:00"),
      endedAt: atTime(addDays(today, -1), "21:15"),
      durationMinutes: 75,
      notes: "Drafted BFS and DFS pseudocode before implementation.",
    },
    {
      courseworkId: null,
      studyBlockId: null,
      source: "manual",
      startedAt: atTime(monday, "18:30"),
      endedAt: atTime(monday, "19:00"),
      durationMinutes: 30,
      notes: "General planning and calendar cleanup.",
    },
  ];
}

function getRecommendationSeedData(
  courseworkIds,
  studyBlockForCoursework,
  today,
) {
  return [
    {
      courseworkId: courseworkIds.graphTraversal,
      studyBlockId: studyBlockForCoursework(courseworkIds.graphTraversal),
      type: "split_task",
      status: "pending",
      title: "Split graph traversal into shorter blocks",
      reason:
        "This assignment is urgent and estimated at four hours, so shorter focused blocks should reduce fatigue and make progress easier to track.",
      proposedChange: {
        splitIntoMinutes: [90, 90, 60],
        preserveDueDate: true,
      },
      editedChange: null,
      decidedAt: null,
    },
    {
      courseworkId: courseworkIds.statsRegression,
      studyBlockId: studyBlockForCoursework(courseworkIds.statsRegression),
      type: "reestimate_effort",
      status: "edited",
      title: "Increase the lab estimate",
      reason:
        "The first timed session took longer than expected, so the remaining estimate may be too optimistic.",
      proposedChange: {
        estimatedMinutes: 240,
      },
      editedChange: {
        estimatedMinutes: 210,
        note: "Student trimmed scope after checking rubric.",
      },
      decidedAt: null,
    },
    {
      courseworkId: courseworkIds.psychReflection,
      studyBlockId: studyBlockForCoursework(courseworkIds.psychReflection),
      type: "start_earlier",
      status: "pending",
      title: "Start the reflection before tonight",
      reason:
        "This is due today and still open, so beginning in the next available block lowers last-minute risk.",
      proposedChange: {
        startBy: "next_available_block",
      },
      editedChange: null,
      decidedAt: null,
    },
    {
      courseworkId: courseworkIds.writingBibliography,
      studyBlockId: studyBlockForCoursework(courseworkIds.writingBibliography),
      type: "add_break",
      status: "approved",
      title: "Add a short break before bibliography work",
      reason:
        "The bibliography follows a heavy technical block, so a short break should help preserve focus.",
      proposedChange: {
        breakMinutes: 15,
      },
      editedChange: null,
      decidedAt: atTime(addDays(today, -1), "18:30"),
    },
    {
      courseworkId: courseworkIds.fairnessReading,
      studyBlockId: studyBlockForCoursework(courseworkIds.fairnessReading),
      type: "postpone_lower_priority",
      status: "rejected",
      title: "Postpone the optional reading",
      reason:
        "This no-due-date reading is lower priority than the urgent problem set and lab report.",
      proposedChange: {
        postponeByDays: 3,
      },
      editedChange: null,
      decidedAt: atTime(addDays(today, -1), "19:00"),
    },
  ];
}

function getGradeSeedData(today, courseIds, courseworkIds) {
  return [
    {
      courseId: courseIds.statistics,
      courseworkId: courseworkIds.quizCorrections,
      assessmentType: "quiz",
      score: 8.5,
      maxScore: 10,
      gradeWeight: 5,
      topic: "Probability",
      isUnusual: false,
      notes: "Corrections improved the original quiz score.",
      gradedAt: addDays(today, -1),
    },
    {
      courseId: courseIds.dataStructures,
      courseworkId: courseworkIds.unitTestRefactor,
      assessmentType: "assignment",
      score: 92,
      maxScore: 100,
      gradeWeight: 8,
      topic: "Testing",
      isUnusual: false,
      notes: "Strong practice result after refactor session.",
      gradedAt: today,
    },
    {
      courseId: courseIds.writing,
      courseworkId: courseworkIds.peerReview,
      assessmentType: "assignment",
      score: 17,
      maxScore: 20,
      gradeWeight: 5,
      topic: "Peer feedback",
      isUnusual: true,
      notes: "Marked unusual because the task was submitted late.",
      gradedAt: today,
    },
  ];
}

async function insertBaseData(today, passwordHash) {
  return transaction(async (client) => {
    await client.query("DELETE FROM users WHERE email = $1;", [demoUser.email]);

    const userResult = await client.query(
      `
        INSERT INTO users (name, email, password_hash, planning_priority)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `,
      [demoUser.name, demoUser.email, passwordHash, demoUser.planningPriority],
    );
    const userId = userResult.rows[0].id;

    const courseIds = {};
    for (const course of getCourseSeedData()) {
      const courseResult = await client.query(
        `
          INSERT INTO courses (
            user_id,
            name,
            code,
            instructor,
            color,
            term,
            target_grade,
            is_archived
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id;
        `,
        [
          userId,
          course.name,
          course.code,
          course.instructor,
          course.color,
          course.term,
          course.targetGrade,
          course.isArchived ?? false,
        ],
      );

      courseIds[course.key] = courseResult.rows[0].id;
    }

    for (const availabilityWindow of getWeeklyAvailabilitySeedData()) {
      await client.query(
        `
          INSERT INTO weekly_availability (
            user_id,
            weekday,
            start_time,
            end_time,
            label
          )
          VALUES ($1, $2, $3, $4, $5);
        `,
        [
          userId,
          availabilityWindow.weekday,
          availabilityWindow.startTime,
          availabilityWindow.endTime,
          availabilityWindow.label,
        ],
      );
    }

    for (const availabilityException of getAvailabilityExceptionSeedData(
      today,
    )) {
      await client.query(
        `
          INSERT INTO availability_exceptions (
            user_id,
            exception_date,
            type,
            is_full_day,
            start_time,
            end_time,
            reason
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7);
        `,
        [
          userId,
          availabilityException.exceptionDate,
          availabilityException.type,
          availabilityException.isFullDay,
          availabilityException.startTime,
          availabilityException.endTime,
          availabilityException.reason,
        ],
      );
    }

    const courseworkIds = {};
    for (const coursework of [
      ...getCourseworkSeedData(today),
      ...getSummerCourseworkSeedData(),
    ]) {
      const courseworkResult = await client.query(
        `
          INSERT INTO coursework (
            user_id,
            course_id,
            title,
            description,
            type,
            due_at,
            priority,
            difficulty,
            estimated_minutes,
            status,
            grade_weight,
            topic,
            notes,
            completed_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id;
        `,
        [
          userId,
          coursework.courseKey ? courseIds[coursework.courseKey] : null,
          coursework.title,
          coursework.description,
          coursework.type,
          coursework.dueAt,
          coursework.priority,
          coursework.difficulty,
          coursework.estimatedMinutes,
          coursework.status,
          coursework.gradeWeight,
          coursework.topic,
          coursework.notes,
          coursework.completedAt ?? null,
        ],
      );

      courseworkIds[coursework.key] = courseworkResult.rows[0].id;
    }

    await client.query(
      `
        INSERT INTO coursework_dependencies (
          coursework_id,
          depends_on_coursework_id
        )
        VALUES ($1, $2);
      `,
      [courseworkIds.graphTraversal, courseworkIds.fairnessReading],
    );

    return { courseIds, courseworkIds, userId };
  });
}

async function getStudyBlocks(userId, studyPlanId) {
  const result = await query(
    `
      SELECT id, coursework_id, start_at, end_at
      FROM study_blocks
      WHERE user_id = $1 AND study_plan_id = $2
      ORDER BY start_at ASC;
    `,
    [userId, studyPlanId],
  );

  return result.rows;
}

async function insertSupportingData({
  courseIds,
  courseworkIds,
  studyBlocks,
  today,
  userId,
}) {
  await transaction(async (client) => {
    const completedBlockIds = studyBlocks.slice(0, 2).map((block) => block.id);

    if (completedBlockIds.length > 0) {
      await client.query(
        `
          UPDATE study_blocks
          SET status = 'completed'
          WHERE id = ANY($1::uuid[]);
        `,
        [completedBlockIds],
      );
    }

    const firstBlockByCourseworkId = new Map();
    for (const studyBlock of studyBlocks) {
      if (!studyBlock.coursework_id) {
        continue;
      }

      const courseworkId = studyBlock.coursework_id;
      if (!firstBlockByCourseworkId.has(courseworkId)) {
        firstBlockByCourseworkId.set(courseworkId, studyBlock.id);
      }
    }

    const studyBlockForCoursework = (courseworkId) =>
      firstBlockByCourseworkId.get(courseworkId) ?? null;

    for (const recommendation of getRecommendationSeedData(
      courseworkIds,
      studyBlockForCoursework,
      today,
    )) {
      await client.query(
        `
          INSERT INTO recommendations (
            user_id,
            coursework_id,
            study_block_id,
            type,
            status,
            title,
            reason,
            proposed_change,
            edited_change,
            decided_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10);
        `,
        [
          userId,
          recommendation.courseworkId,
          recommendation.studyBlockId,
          recommendation.type,
          recommendation.status,
          recommendation.title,
          recommendation.reason,
          JSON.stringify(recommendation.proposedChange),
          recommendation.editedChange
            ? JSON.stringify(recommendation.editedChange)
            : null,
          recommendation.decidedAt,
        ],
      );
    }

    for (const studySession of [
      ...getSessionSeedData(today, courseworkIds, studyBlockForCoursework),
      ...getSummerSessionSeedData(courseworkIds),
    ]) {
      await client.query(
        `
          INSERT INTO study_sessions (
            user_id,
            coursework_id,
            study_block_id,
            source,
            started_at,
            ended_at,
            duration_minutes,
            notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `,
        [
          userId,
          studySession.courseworkId,
          studySession.studyBlockId,
          studySession.source,
          studySession.startedAt,
          studySession.endedAt,
          studySession.durationMinutes,
          studySession.notes,
        ],
      );
    }

    for (const checkIn of [
      ...getUniqueCheckIns(today),
      ...getSummerCheckInSeedData(),
    ]) {
      await client.query(
        `
          INSERT INTO check_ins (
            user_id,
            check_in_date,
            energy_level,
            stress_level,
            focus_level,
            note
          )
          VALUES ($1, $2, $3, $4, $5, $6);
        `,
        [
          userId,
          checkIn.checkInDate,
          checkIn.energyLevel,
          checkIn.stressLevel,
          checkIn.focusLevel,
          checkIn.note,
        ],
      );
    }

    for (const grade of [
      ...getGradeSeedData(today, courseIds, courseworkIds),
      ...getSummerGradeSeedData(courseIds, courseworkIds),
    ]) {
      await client.query(
        `
          INSERT INTO grades (
            user_id,
            course_id,
            coursework_id,
            assessment_type,
            score,
            max_score,
            grade_weight,
            topic,
            is_unusual,
            notes,
            graded_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
        `,
        [
          userId,
          grade.courseId,
          grade.courseworkId,
          grade.assessmentType,
          grade.score,
          grade.maxScore,
          grade.gradeWeight,
          grade.topic,
          grade.isUnusual,
          grade.notes,
          grade.gradedAt,
        ],
      );
    }
  });
}

async function seedDummyData() {
  const today = toLocalDateString(new Date());
  const passwordHash = await hashPassword(demoUser.password);
  const { courseIds, courseworkIds, userId } = await insertBaseData(
    today,
    passwordHash,
  );
  const generatedPlan = await generateStudyPlanForUser(userId, {
    startDate: today,
    endDate: addDays(today, 6),
    planningPriority: demoUser.planningPriority,
  });

  await approveStudyPlanForUser(userId, generatedPlan.studyPlan.id);

  const studyBlocks = await getStudyBlocks(userId, generatedPlan.studyPlan.id);
  await insertSupportingData({
    courseIds,
    courseworkIds,
    studyBlocks,
    today,
    userId,
  });

  console.log("Dummy StudyGuard data seeded successfully.");
  console.log("Demo login:");
  console.log("  Email: " + demoUser.email);
  console.log("  Password: " + demoUser.password);
  console.log("Seeded records:");
  console.log("  Courses: " + Object.keys(courseIds).length);
  console.log("  Coursework: " + Object.keys(courseworkIds).length);
  console.log("  Study blocks: " + studyBlocks.length);
  console.log("  Recommendations: 5");
  console.log(
    "  Study sessions: " + (6 + getSummerSessionSeedData(courseworkIds).length),
  );
  console.log("  Summer semester: completed Summer 2026 baseline included");
}

try {
  await seedDummyData();
} catch (error) {
  console.error("Dummy data seed failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
