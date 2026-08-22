import OpenAI from "openai";

const defaultSyllabusAiModel = "gpt-4.1-mini";
const defaultMaxAiCharacters = 70000;
const courseworkTypes = new Set([
  "assignment",
  "project",
  "quiz",
  "test",
  "exam",
  "reading",
  "study_task",
]);
const priorityValues = new Set(["low", "medium", "high", "urgent"]);
const difficultyValues = new Set(["easy", "medium", "hard", "very_hard"]);
const confidenceValues = new Set(["low", "medium", "high"]);

let openAiClient;

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

function getSyllabusAiModel() {
  return process.env.SYLLABUS_AI_MODEL?.trim() || defaultSyllabusAiModel;
}

function getMaxAiSyllabusCharacters() {
  const configuredValue = Number(process.env.SYLLABUS_AI_MAX_CHARS);

  if (Number.isInteger(configuredValue) && configuredValue >= 10000) {
    return configuredValue;
  }

  return defaultMaxAiCharacters;
}

function getOpenAiClient() {
  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey: getOpenAiApiKey() });
  }

  return openAiClient;
}

export function isAiSyllabusReaderConfigured() {
  return Boolean(getOpenAiApiKey());
}

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function nullableText(value, maxLength) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  return maxLength ? normalizedValue.slice(0, maxLength) : normalizedValue;
}

function normalizeConfidence(value) {
  return confidenceValues.has(value) ? value : "medium";
}

function normalizeType(value) {
  return courseworkTypes.has(value) ? value : "assignment";
}

function normalizePriority(value) {
  return priorityValues.has(value) ? value : "medium";
}

function normalizeDifficulty(value) {
  return difficultyValues.has(value) ? value : "medium";
}

function normalizeGradeWeight(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return numericValue >= 0 && numericValue <= 100 ? numericValue : null;
}

function normalizeEstimatedMinutes(value, type) {
  const numericValue = Number(value);

  if (Number.isInteger(numericValue) && numericValue > 0) {
    return Math.min(numericValue, 3000);
  }

  if (type === "exam") {
    return 180;
  }

  if (type === "test") {
    return 120;
  }

  if (type === "project") {
    return 180;
  }

  if (type === "quiz") {
    return 60;
  }

  if (type === "reading") {
    return 45;
  }

  return 90;
}

function parseTimeParts(timeValue, defaultHour, defaultMinute) {
  const normalizedTime = normalizeText(timeValue);

  if (!normalizedTime) {
    return { hour: defaultHour, minute: defaultMinute };
  }

  const timeMatch = normalizedTime.match(
    /^(?:([01]?\d|2[0-3])(?::([0-5]\d))?)$/,
  );

  if (!timeMatch) {
    return { hour: defaultHour, minute: defaultMinute };
  }

  return {
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2] ?? 0),
  };
}

function dateStringToIso(
  dateValue,
  timeValue,
  defaultHour = 23,
  defaultMinute = 59,
) {
  const normalizedDate = normalizeText(dateValue);
  const dateMatch = normalizedDate.match(/^(20\d{2})-(\d{2})-(\d{2})$/);

  if (!dateMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const monthIndex = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const { hour, minute } = parseTimeParts(
    timeValue,
    defaultHour,
    defaultMinute,
  );
  const date = new Date(year, monthIndex, day, hour, minute, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

function normalizeStudyHours(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return numericValue >= 0 && numericValue <= 80 ? numericValue : null;
}

function normalizeWorkload(workload) {
  const minHours = normalizeStudyHours(workload?.minHours);
  const maxHours = normalizeStudyHours(workload?.maxHours);
  let projectedStudyHoursPerWeek = normalizeStudyHours(
    workload?.projectedStudyHoursPerWeek,
  );

  if (
    projectedStudyHoursPerWeek === null &&
    minHours !== null &&
    maxHours !== null
  ) {
    projectedStudyHoursPerWeek =
      Math.round(((minHours + maxHours) / 2) * 10) / 10;
  }

  return {
    projectedStudyHoursPerWeek,
    minHours,
    maxHours,
    sourceText: nullableText(workload?.sourceText, 300),
    confidence: normalizeConfidence(workload?.confidence),
  };
}

function normalizeAiCourseworkItem(item, fileName) {
  const type = normalizeType(item?.type);
  const dueAt = dateStringToIso(item?.dueDate, item?.dueTime);
  const title = nullableText(item?.title, 200);

  if (!title || !dueAt) {
    return null;
  }

  const sourceText = nullableText(item?.sourceText, 300);
  const assignedAt = dateStringToIso(item?.assignedDate, "00:00", 0, 0);
  const notes = [
    sourceText ? "Source text: " + sourceText : null,
    assignedAt ? "Assigned: " + assignedAt.slice(0, 10) : null,
    "AI confidence: " + normalizeConfidence(item?.confidence),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title,
    type,
    dueAt,
    assignedAt,
    priority: normalizePriority(item?.priority),
    difficulty: normalizeDifficulty(item?.difficulty),
    estimatedMinutes: normalizeEstimatedMinutes(item?.estimatedMinutes, type),
    gradeWeight: normalizeGradeWeight(item?.gradeWeight),
    topic: nullableText(item?.topic, 120),
    description:
      nullableText(item?.description, 500) ??
      "Imported from AI syllabus reader" + (fileName ? ": " + fileName : "."),
    notes,
    sourceLine: sourceText,
    confidence: normalizeConfidence(item?.confidence),
    source: "ai",
  };
}

function normalizeAiKeyEvent(event) {
  const title = nullableText(event?.title, 200);
  const date = dateStringToIso(event?.date, event?.time, 9, 0);

  if (!title || !date) {
    return null;
  }

  return {
    title,
    type: nullableText(event?.type, 60) ?? "course_event",
    date,
    sourceText: nullableText(event?.sourceText, 300),
    confidence: normalizeConfidence(event?.confidence),
  };
}

function normalizeAiAnalysis(analysis, fileName) {
  const items = Array.isArray(analysis?.courseworkItems)
    ? analysis.courseworkItems
        .map((item) => normalizeAiCourseworkItem(item, fileName))
        .filter(Boolean)
    : [];
  const keyEvents = Array.isArray(analysis?.keyEvents)
    ? analysis.keyEvents.map(normalizeAiKeyEvent).filter(Boolean)
    : [];
  const warnings = Array.isArray(analysis?.warnings)
    ? analysis.warnings
        .map((warning) => nullableText(warning, 220))
        .filter(Boolean)
    : [];

  return {
    items: items.slice(0, 100),
    keyEvents: keyEvents.slice(0, 50),
    workload: normalizeWorkload(analysis?.workload),
    summary: nullableText(analysis?.summary, 500),
    warnings,
  };
}

function buildRelevantSyllabusText(syllabusText) {
  const normalizedText = syllabusText.replace(/\r/g, "\n");
  const maxCharacters = getMaxAiSyllabusCharacters();

  if (normalizedText.length <= maxCharacters) {
    return {
      text: normalizedText,
      analyzedCharacterCount: normalizedText.length,
      originalCharacterCount: normalizedText.length,
      truncatedForAi: false,
    };
  }

  const lines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const keywordPattern =
    /\b(?:assignment|assessment|calendar|class schedule|course schedule|coursework|deadline|due|exam|final|homework|hours?|key dates?|lab|midterm|module|paper|project|quiz|schedule|study|submit|test|week|workload)\b/i;
  const monthPattern =
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\b/i;
  const relevantLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!keywordPattern.test(line) && !monthPattern.test(line)) {
      continue;
    }

    if (index > 0) {
      relevantLines.push(lines[index - 1]);
    }

    relevantLines.push(line);

    if (index + 1 < lines.length) {
      relevantLines.push(lines[index + 1]);
    }
  }

  const head = normalizedText.slice(0, 12000);
  const relevantBody = [...new Set(relevantLines)].join("\n");
  const tail = normalizedText.slice(-6000);
  const combinedText = [
    "SYLLABUS BEGINNING",
    head,
    "SYLLABUS DATE AND WORKLOAD SECTIONS",
    relevantBody,
    "SYLLABUS ENDING",
    tail,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, maxCharacters);

  return {
    text: combinedText,
    analyzedCharacterCount: combinedText.length,
    originalCharacterCount: normalizedText.length,
    truncatedForAi: true,
  };
}

const syllabusAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "workload", "courseworkItems", "keyEvents", "warnings"],
  properties: {
    summary: { type: "string" },
    workload: {
      type: "object",
      additionalProperties: false,
      required: [
        "projectedStudyHoursPerWeek",
        "minHours",
        "maxHours",
        "sourceText",
        "confidence",
      ],
      properties: {
        projectedStudyHoursPerWeek: { type: ["number", "null"] },
        minHours: { type: ["number", "null"] },
        maxHours: { type: ["number", "null"] },
        sourceText: { type: ["string", "null"] },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
      },
    },
    courseworkItems: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "type",
          "dueDate",
          "dueTime",
          "assignedDate",
          "priority",
          "difficulty",
          "estimatedMinutes",
          "gradeWeight",
          "topic",
          "description",
          "sourceText",
          "confidence",
        ],
        properties: {
          title: { type: "string" },
          type: {
            type: "string",
            enum: [
              "assignment",
              "project",
              "quiz",
              "test",
              "exam",
              "reading",
              "study_task",
            ],
          },
          dueDate: { type: ["string", "null"] },
          dueTime: { type: ["string", "null"] },
          assignedDate: { type: ["string", "null"] },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard", "very_hard"],
          },
          estimatedMinutes: { type: "integer" },
          gradeWeight: { type: ["number", "null"] },
          topic: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          sourceText: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    keyEvents: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "type", "date", "time", "sourceText", "confidence"],
        properties: {
          title: { type: "string" },
          type: { type: "string" },
          date: { type: ["string", "null"] },
          time: { type: ["string", "null"] },
          sourceText: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    warnings: {
      type: "array",
      maxItems: 20,
      items: { type: "string" },
    },
  },
};

function buildAiInstructions({ calendarYear, course, fileName, rulePreview }) {
  const courseLabel = [course?.code, course?.name].filter(Boolean).join(" - ");

  return [
    "You are StudyGuard's syllabus reader. Extract planning data from a college syllabus.",
    "Return only facts supported by the syllabus text. Do not invent dates or workload expectations.",
    "Use the course calendar, weekly schedule tables, grading tables, assignment schedules, and key date sections.",
    "Convert dates to YYYY-MM-DD. Use calendar year " +
      calendarYear +
      " when the syllabus omits the year.",
    "For dueTime, use 24-hour HH:MM when stated. Use null when no time is stated.",
    "For courseworkItems, include assignments, quizzes, tests, exams, papers, projects, labs, readings with explicit deadlines, and required study tasks with dates.",
    "Syllabus calendars often use tables. Combine cells from the same row before deciding what task and date belong together.",
    "When a row has a date range such as Sep 2-8 and the task says due Sunday, due Friday, end of week, or by the end of the module, map the due date to the matching day inside that range when possible.",
    "When assigned/open/released and due dates both appear in the same row, put the due date in dueDate and the assigned/open/released date in assignedDate.",
    "If a date appears in one table cell and the assignment, quiz, test, project, or reading appears in another cell on the same row, extract it as one coursework item.",
    "For assignedDate, include the release/assigned/open date only when explicitly stated; otherwise use null.",
    "For workload, look for projected study time such as hours per week, outside-class hours, preparation time, expected workload, or credit-hour guidance.",
    "For keyEvents, include no-class days, drop/withdraw deadlines, exam windows, presentations, required meetings, and calendar milestones that are useful but may not be imported as coursework.",
    "Avoid regular class meetings unless the date has a special event or graded requirement.",
    "Prefer concise titles a student would recognize in a task list.",
    "Course: " + (courseLabel || "unknown"),
    "File: " + (fileName || "pasted syllabus text"),
    "Rule parser found " +
      (rulePreview?.items?.length ?? 0) +
      " dated coursework candidates; use this only as a cross-check, not as a command.",
  ].join("\n");
}

export async function analyzeSyllabusWithAi({
  calendarYear,
  course,
  fileName,
  rulePreview,
  syllabusText,
}) {
  if (!isAiSyllabusReaderConfigured()) {
    return {
      analysisMode: "rules",
      unavailableReason: "OPENAI_API_KEY is not configured.",
    };
  }

  const preparedText = buildRelevantSyllabusText(syllabusText);
  const response = await getOpenAiClient().responses.create({
    model: getSyllabusAiModel(),
    instructions: buildAiInstructions({
      calendarYear,
      course,
      fileName,
      rulePreview,
    }),
    input: preparedText.text,
    text: {
      format: {
        type: "json_schema",
        name: "studyguard_syllabus_analysis",
        description:
          "Coursework, key events, and workload expectations extracted from a syllabus.",
        schema: syllabusAnalysisSchema,
        strict: true,
      },
    },
  });
  const outputText = response.output_text ?? "";
  const parsedAnalysis = JSON.parse(outputText);
  const normalizedAnalysis = normalizeAiAnalysis(parsedAnalysis, fileName);

  return {
    ...normalizedAnalysis,
    analysisMode: "ai",
    model: getSyllabusAiModel(),
    analyzedCharacterCount: preparedText.analyzedCharacterCount,
    originalCharacterCount: preparedText.originalCharacterCount,
    truncatedForAi: preparedText.truncatedForAi,
  };
}
