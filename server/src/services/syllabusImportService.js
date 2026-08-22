import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { query, transaction } from "../database/db.js";
import {
  analyzeSyllabusWithAi,
  isAiSyllabusReaderConfigured,
} from "./aiSyllabusReaderService.js";
import { badRequest, notFound } from "../utils/httpErrors.js";
import { getCourseworkForUser } from "./courseworkService.js";

const courseNotFoundMessage = "Course not found.";
const maxImportedItems = 100;
const defaultDueHour = 23;
const defaultDueMinute = 59;
const defaultSyllabusAnalysisMode = "auto";
const weekdayIndexes = new Map([
  ["sunday", 0],
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
  ["saturday", 6],
]);

function getSyllabusFileExtension(fileName = "") {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return "";
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

async function extractTextFromPdf(file) {
  const parser = new PDFParse({ data: file.buffer });

  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractTextFromDocx(file) {
  const result = await mammoth.extractRawText({ buffer: file.buffer });
  return result.value ?? "";
}

function extractTextFromTextFile(file) {
  return file.buffer.toString("utf8");
}

async function extractTextFromSyllabusFile(file) {
  const extension = getSyllabusFileExtension(file.originalname);

  try {
    if (extension === ".pdf") {
      return await extractTextFromPdf(file);
    }

    if (extension === ".docx") {
      return await extractTextFromDocx(file);
    }

    if ([".txt", ".md", ".csv"].includes(extension)) {
      return extractTextFromTextFile(file);
    }
  } catch {
    throw badRequest("Could not extract text from the syllabus file.");
  }

  throw badRequest(
    "Upload a PDF, Word .docx, text, Markdown, or CSV syllabus file.",
  );
}

function assertExtractedSyllabusText(syllabusText) {
  if (!syllabusText || syllabusText.trim().length < 20) {
    throw badRequest("Could not extract enough text from the syllabus file.");
  }
}

const monthIndexes = new Map([
  ["jan", 0],
  ["january", 0],
  ["feb", 1],
  ["february", 1],
  ["mar", 2],
  ["march", 2],
  ["apr", 3],
  ["april", 3],
  ["may", 4],
  ["jun", 5],
  ["june", 5],
  ["jul", 6],
  ["july", 6],
  ["aug", 7],
  ["august", 7],
  ["sep", 8],
  ["sept", 8],
  ["september", 8],
  ["oct", 9],
  ["october", 9],
  ["nov", 10],
  ["november", 10],
  ["dec", 11],
  ["december", 11],
]);

const monthNamePattern =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|sept(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const datePatterns = [
  {
    kind: "month_name",
    regex: new RegExp(
      "\\b(" +
        monthNamePattern +
        ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{2,4}))?\\b",
      "i",
    ),
  },
  {
    kind: "iso",
    regex: /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/,
  },
  {
    kind: "numeric",
    regex: /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,
  },
];

const actionKeywordPatterns = [
  /\bassignment\b/i,
  /\bhomework\b/i,
  /\bhw\s*\d*\b/i,
  /\bproblem\s*set\b/i,
  /\bpset\b/i,
  /\bproject\b/i,
  /\bquiz\b/i,
  /\btest\b/i,
  /\bexam\b/i,
  /\bmidterm\b/i,
  /\bfinal\b/i,
  /\bpaper\b/i,
  /\bessay\b/i,
  /\breport\b/i,
  /\blab\b/i,
  /\bpresentation\b/i,
  /\breading\b/i,
  /\breflection\b/i,
  /\bdiscussion\b/i,
  /\bdue\b/i,
  /\bdeadline\b/i,
  /\bsubmit\b/i,
];

const courseworkTypeRules = [
  { type: "exam", pattern: /\b(final|midterm|exam)\b/i },
  { type: "test", pattern: /\btest\b/i },
  { type: "quiz", pattern: /\bquiz\b/i },
  { type: "project", pattern: /\b(project|presentation)\b/i },
  { type: "reading", pattern: /\b(reading|chapter|article)\b/i },
  {
    type: "assignment",
    pattern:
      /\b(assignment|homework|hw\s*\d*|problem\s*set|pset|paper|essay|report|lab|reflection|discussion|submit)\b/i,
  },
];

function throwCourseNotFound() {
  throw notFound(courseNotFoundMessage);
}

function normalizeLine(line) {
  return line.replace(/\s+/g, " ").trim();
}

function normalizeYear(yearValue, calendarYear) {
  if (!yearValue) {
    return calendarYear;
  }

  const numericYear = Number(yearValue);
  return numericYear < 100 ? 2000 + numericYear : numericYear;
}

function getMonthIndex(monthName) {
  return monthIndexes.get(monthName.toLowerCase().replace(/\./g, ""));
}

function getLineTime(line) {
  const twelveHourMatch = line.match(
    /\b(?:by|at|before)?\s*(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
  );

  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2] ?? 0);
    const meridiem = twelveHourMatch[3].toLowerCase();

    if (meridiem.startsWith("p") && hour !== 12) {
      hour += 12;
    }

    if (meridiem.startsWith("a") && hour === 12) {
      hour = 0;
    }

    return { hour, minute };
  }

  const twentyFourHourMatch = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);

  if (twentyFourHourMatch) {
    return {
      hour: Number(twentyFourHourMatch[1]),
      minute: Number(twentyFourHourMatch[2]),
    };
  }

  return { hour: defaultDueHour, minute: defaultDueMinute };
}

function isValidDateParts(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === monthIndex &&
    date.getDate() === day
  );
}

function resolveDateYear({ calendarYear, day, explicitYear, monthIndex, now }) {
  let year = explicitYear ?? calendarYear;

  if (!explicitYear) {
    const candidate = new Date(year, monthIndex, day);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (candidate < thirtyDaysAgo) {
      year += 1;
    }
  }

  return year;
}

function buildDueAt({
  calendarYear,
  day,
  explicitYear,
  line,
  monthIndex,
  now,
}) {
  const year = resolveDateYear({
    calendarYear,
    day,
    explicitYear,
    monthIndex,
    now,
  });

  if (!isValidDateParts(year, monthIndex, day)) {
    return null;
  }

  const { hour, minute } = getLineTime(line);
  return new Date(year, monthIndex, day, hour, minute, 0, 0).toISOString();
}

function getDueKeywordIndex(line) {
  const match = line.match(
    /\b(?:due|deadline|submit|submission|closes?|by|before)\b/i,
  );
  return match ? match.index : -1;
}

function getAssignedKeywordIndex(line) {
  const match = line.match(
    /\b(?:assigned|released|available|opens?|posted|given)\b/i,
  );
  return match ? match.index : -1;
}

function addDateCandidate(candidates, candidate) {
  if (!candidate?.dueAt) {
    return;
  }

  const dedupeKey = [
    candidate.matchText,
    candidate.dueAt,
    candidate.index,
  ].join("|");

  if (
    candidates.some((currentCandidate) => currentCandidate.key === dedupeKey)
  ) {
    return;
  }

  candidates.push({ ...candidate, key: dedupeKey });
}

function createDateCandidate({
  calendarYear,
  day,
  explicitYear,
  index,
  isRangeEnd = false,
  line,
  matchText,
  monthIndex,
  now,
}) {
  const dueAt = buildDueAt({
    calendarYear,
    day,
    explicitYear,
    line,
    monthIndex,
    now,
  });

  if (!dueAt) {
    return null;
  }

  return {
    dueAt,
    index,
    isRangeEnd,
    matchText,
  };
}

function findDateCandidatesInLine(line, calendarYear, now) {
  const candidates = [];
  const monthNameRangeRegex = new RegExp(
    "\\b(" +
      monthNamePattern +
      ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|—|to)\\s*(?:(" +
      monthNamePattern +
      ")\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:(?:,\\s*|\\s+)(20\\d{2}|\\d{4}))?\\b",
    "gi",
  );
  const monthNameRegex = new RegExp(
    "\\b(" +
      monthNamePattern +
      ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:(?:,\\s*|\\s+)(20\\d{2}|\\d{4}))?\\b",
    "gi",
  );
  const isoRegex = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g;
  const numericRegex = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g;
  let match;

  while ((match = monthNameRangeRegex.exec(line)) !== null) {
    const startMonthIndex = getMonthIndex(match[1]);
    const endMonthIndex = match[3] ? getMonthIndex(match[3]) : startMonthIndex;
    const explicitYear = match[5]
      ? normalizeYear(match[5], calendarYear)
      : undefined;

    addDateCandidate(
      candidates,
      createDateCandidate({
        calendarYear,
        day: Number(match[2]),
        explicitYear,
        index: match.index,
        line,
        matchText: match[0],
        monthIndex: startMonthIndex,
        now,
      }),
    );
    addDateCandidate(
      candidates,
      createDateCandidate({
        calendarYear,
        day: Number(match[4]),
        explicitYear,
        index: match.index + match[0].length - String(match[4]).length,
        isRangeEnd: true,
        line,
        matchText: match[0],
        monthIndex: endMonthIndex,
        now,
      }),
    );
  }

  while ((match = monthNameRegex.exec(line)) !== null) {
    addDateCandidate(
      candidates,
      createDateCandidate({
        calendarYear,
        day: Number(match[2]),
        explicitYear: match[3]
          ? normalizeYear(match[3], calendarYear)
          : undefined,
        index: match.index,
        line,
        matchText: match[0],
        monthIndex: getMonthIndex(match[1]),
        now,
      }),
    );
  }

  while ((match = isoRegex.exec(line)) !== null) {
    addDateCandidate(
      candidates,
      createDateCandidate({
        calendarYear,
        day: Number(match[3]),
        explicitYear: Number(match[1]),
        index: match.index,
        line,
        matchText: match[0],
        monthIndex: Number(match[2]) - 1,
        now,
      }),
    );
  }

  while ((match = numericRegex.exec(line)) !== null) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const month = first > 12 && second <= 12 ? second : first;
    const day = first > 12 && second <= 12 ? first : second;

    addDateCandidate(
      candidates,
      createDateCandidate({
        calendarYear,
        day,
        explicitYear: match[3]
          ? normalizeYear(match[3], calendarYear)
          : undefined,
        index: match.index,
        line,
        matchText: match[0],
        monthIndex: month - 1,
        now,
      }),
    );
  }

  return candidates.sort((left, right) => left.index - right.index);
}

function getDueWeekdayIndex(line, dueKeywordIndex) {
  if (dueKeywordIndex < 0) {
    return null;
  }

  const dueText = line.slice(dueKeywordIndex);
  const match = dueText.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );

  if (!match) {
    return null;
  }

  return weekdayIndexes.get(match[1].toLowerCase()) ?? null;
}

function getWeekdayCandidateFromRange(line, candidates, dueKeywordIndex) {
  const weekdayIndex = getDueWeekdayIndex(line, dueKeywordIndex);

  if (weekdayIndex === null) {
    return null;
  }

  const rangeEndCandidate = candidates.find(
    (candidate) => candidate.isRangeEnd,
  );

  if (!rangeEndCandidate) {
    return null;
  }

  const rangeStartCandidate = candidates.find(
    (candidate) => candidate.matchText === rangeEndCandidate.matchText,
  );

  if (!rangeStartCandidate) {
    return null;
  }

  const startDate = new Date(rangeStartCandidate.dueAt);
  const endDate = new Date(rangeEndCandidate.dueAt);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  for (
    const date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    if (date.getDay() === weekdayIndex) {
      const { hour, minute } = getLineTime(line);
      date.setHours(hour, minute, 0, 0);

      return {
        dueAt: date.toISOString(),
        index: rangeEndCandidate.index,
        isRangeEnd: true,
        matchText: rangeEndCandidate.matchText,
      };
    }
  }

  return null;
}

function chooseCourseworkDateCandidate(line, candidates) {
  if (candidates.length === 0) {
    return null;
  }

  const dueKeywordIndex = getDueKeywordIndex(line);

  if (dueKeywordIndex >= 0) {
    const candidateAfterDueKeyword = candidates.find(
      (candidate) => candidate.index >= dueKeywordIndex,
    );

    if (candidateAfterDueKeyword) {
      return candidateAfterDueKeyword;
    }

    const weekdayCandidate = getWeekdayCandidateFromRange(
      line,
      candidates,
      dueKeywordIndex,
    );

    if (weekdayCandidate) {
      return weekdayCandidate;
    }

    const rangeEndCandidate = [...candidates]
      .reverse()
      .find((candidate) => candidate.isRangeEnd);

    if (rangeEndCandidate) {
      return rangeEndCandidate;
    }

    return candidates[candidates.length - 1];
  }

  return candidates[0];
}

function findDateInLine(line, calendarYear, now) {
  return chooseCourseworkDateCandidate(
    line,
    findDateCandidatesInLine(line, calendarYear, now),
  );
}

function formatLocalDateFromIso(value) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function findAssignedDateInLine(line, calendarYear, now) {
  const assignedKeywordIndex = getAssignedKeywordIndex(line);

  if (assignedKeywordIndex < 0) {
    return null;
  }

  return findDateCandidatesInLine(line, calendarYear, now).find(
    (candidate) => candidate.index >= assignedKeywordIndex,
  );
}

function hasActionKeyword(line) {
  return actionKeywordPatterns.some((pattern) => pattern.test(line));
}

function isLikelyNonCourseworkLine(line) {
  if (!/\b(lecture|class meeting|overview|topic)\b/i.test(line)) {
    return false;
  }

  return !/\b(due|deadline|submit|assignment|homework|quiz|test|exam|midterm|final|project|paper|essay|report|lab|presentation|reading)\b/i.test(
    line,
  );
}

function inferType(line) {
  const rule = courseworkTypeRules.find((currentRule) =>
    currentRule.pattern.test(line),
  );

  return rule?.type ?? "assignment";
}

function inferDifficulty(type, line) {
  if (type === "exam" || /\b(final|midterm|capstone)\b/i.test(line)) {
    return "hard";
  }

  if (
    type === "project" ||
    /\b(research|analysis|presentation)\b/i.test(line)
  ) {
    return "hard";
  }

  if (type === "quiz" || type === "reading") {
    return "easy";
  }

  return "medium";
}

function inferEstimatedMinutes(type, line) {
  const minuteMatch = line.match(/\b(\d{1,3})\s*(?:min|mins|minutes)\b/i);

  if (minuteMatch) {
    return Math.max(15, Number(minuteMatch[1]));
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

function inferPriority(dueAt, type, now) {
  const daysUntilDue = Math.ceil(
    (new Date(dueAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (daysUntilDue <= 3 || type === "exam") {
    return "urgent";
  }

  if (daysUntilDue <= 10 || type === "test" || type === "project") {
    return "high";
  }

  if (daysUntilDue <= 30) {
    return "medium";
  }

  return "low";
}

function inferGradeWeight(line) {
  const percentMatch = line.match(/\b(\d{1,3}(?:\.\d{1,2})?)\s*%/);

  if (!percentMatch) {
    return null;
  }

  const weight = Number(percentMatch[1]);
  return weight >= 0 && weight <= 100 ? weight : null;
}

function stripKnownDateText(line, dateMatchText) {
  const monthNameDateRegex = new RegExp(
    "\\b(?:" +
      monthNamePattern +
      ")\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:(?:,\\s*|\\s+)(?:20\\d{2}|\\d{4}))?\\b",
    "gi",
  );

  return line
    .replace(dateMatchText, " ")
    .replace(monthNameDateRegex, " ")
    .replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(
      /\b(?:by|at|before)?\s*(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi,
      " ",
    )
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, " ");
}

function cleanTitleFragment(fragment) {
  return fragment
    .replace(/^\s*(?:week|module|unit|class)\s+\d+\s*/i, "")
    .replace(
      /^\s*(?:date|dates|topic|topics|readings?|work|due|assignments?)\s*:?\s*$/i,
      "",
    )
    .replace(/^\s*[-:*|,]+\s*/, "")
    .replace(
      /\b(?:due|deadline|submit|submission|assigned|released|posted|given|opens?|available|closes?)\b\s*:?/gi,
      "",
    )
    .replace(
      /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
      "",
    )
    .replace(/\b\d{1,3}(?:\.\d{1,2})?\s*%/g, "")
    .replace(/\s*[-:*|,]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromLine(line, dateMatchText, type) {
  const rawCells = stripKnownDateText(line, dateMatchText)
    .split("|")
    .map(normalizeLine)
    .filter(Boolean);
  const actionCell = [...rawCells]
    .reverse()
    .find((cell) => hasActionKeyword(cell) || inferType(cell) !== "assignment");
  const fallbackCell = rawCells[rawCells.length - 1];
  const cleanedTitle = cleanTitleFragment(actionCell ?? fallbackCell ?? "");

  if (cleanedTitle) {
    return cleanedTitle.slice(0, 200);
  }

  return type
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function topicFromTitle(title) {
  const colonIndex = title.indexOf(":");

  if (colonIndex === -1) {
    return null;
  }

  const topic = title.slice(colonIndex + 1).trim();
  return topic ? topic.slice(0, 120) : null;
}

function getConfidence(line) {
  if (
    /\b(due|deadline|submit|exam|test|quiz|assignment|project)\b/i.test(line)
  ) {
    return "high";
  }

  return "medium";
}

export function extractSyllabusCourseworkItems({
  calendarYear = new Date().getFullYear(),
  fileName,
  now = new Date(),
  syllabusText,
}) {
  const lines = getSyllabusLines(syllabusText, 2000);
  const seenKeys = new Set();
  const items = [];
  let datedLineCount = 0;
  let skippedLineCount = 0;

  for (const line of lines) {
    const parsedDate = findDateInLine(line, calendarYear, now);

    if (!parsedDate) {
      continue;
    }

    datedLineCount += 1;

    if (!hasActionKeyword(line) || isLikelyNonCourseworkLine(line)) {
      skippedLineCount += 1;
      continue;
    }

    const type = inferType(line);
    const title = titleFromLine(line, parsedDate.matchText, type);
    const dueAt = parsedDate.dueAt;
    const dedupeKey = [title.toLowerCase(), dueAt].join("|");

    if (seenKeys.has(dedupeKey)) {
      skippedLineCount += 1;
      continue;
    }

    seenKeys.add(dedupeKey);
    const assignedDate = findAssignedDateInLine(line, calendarYear, now);
    const notes = [
      assignedDate
        ? "Assigned: " + formatLocalDateFromIso(assignedDate.dueAt)
        : null,
      "Source line: " + line,
    ]
      .filter(Boolean)
      .join("\n");

    items.push({
      title,
      type,
      dueAt,
      assignedAt: assignedDate?.dueAt ?? null,
      priority: inferPriority(dueAt, type, now),
      difficulty: inferDifficulty(type, line),
      estimatedMinutes: inferEstimatedMinutes(type, line),
      gradeWeight: inferGradeWeight(line),
      topic: topicFromTitle(title),
      description:
        "Imported from syllabus" + (fileName ? ": " + fileName : "."),
      notes,
      sourceLine: line,
      confidence: getConfidence(line),
    });

    if (items.length >= maxImportedItems) {
      break;
    }
  }

  return {
    items,
    meta: {
      datedLineCount,
      extractedItemCount: items.length,
      skippedLineCount,
    },
  };
}

const keyEventKeywordPatterns = [
  /\bno\s+class\b/i,
  /\bcancel(?:led|ed)?\s+class\b/i,
  /\bholiday\b/i,
  /\bbreak\b/i,
  /\blast\s+day\b/i,
  /\bwithdraw\b/i,
  /\bdrop\b/i,
  /\bregistration\b/i,
  /\badd\/drop\b/i,
  /\bpresentation\s+day\b/i,
  /\bexam\s+window\b/i,
  /\boffice\s+hours\b/i,
  /\bconference\b/i,
  /\bpeer\s+review\b/i,
];

const workloadPatterns = [
  /\b(?:expect(?:ed)?|plan|budget|spend|study|work|workload|outside\s+class|prepare)\b[^\n.]{0,120}?\b(\d{1,2}(?:\.\d+)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:per|\/)?\s*(?:week|weekly)?\b/i,
  /\b(\d{1,2}(?:\.\d+)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:per|\/)?\s*(?:week|weekly)\b[^\n.]{0,120}?\b(?:expect(?:ed)?|plan|budget|spend|study|work|workload|outside\s+class|prepare)\b/i,
  /\b(?:expect(?:ed)?|plan|budget|spend|study|work|workload|outside\s+class|prepare)\b[^\n.]{0,120}?\b(\d{1,2}(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:per|\/)?\s*(?:week|weekly)\b/i,
  /\b(\d{1,2}(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:per|\/)?\s*(?:week|weekly)\b[^\n.]{0,120}?\b(?:expect(?:ed)?|plan|budget|spend|study|work|workload|outside\s+class|prepare)\b/i,
];

function splitSyllabusLineIntoCells(line) {
  return line
    .split(/\s+[|]\s+|\t+|\s{3,}/g)
    .map(normalizeLine)
    .filter(Boolean);
}

function addSyllabusLineCandidate(candidates, seenLines, line) {
  const normalizedLine = normalizeLine(
    line.replace(/\t/g, " | ").replace(/\s*\|\s*/g, " | "),
  );

  if (!normalizedLine || seenLines.has(normalizedLine)) {
    return;
  }

  seenLines.add(normalizedLine);
  candidates.push(normalizedLine);
}

function hasDateSignal(line) {
  const monthNameRegex = new RegExp(
    "\\b(?:" + monthNamePattern + ")\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b",
    "i",
  );

  return (
    monthNameRegex.test(line) ||
    /\b20\d{2}-\d{1,2}-\d{1,2}\b/.test(line) ||
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(line)
  );
}

function shouldJoinSyllabusLines(lines) {
  const hasDateOnlyLine = lines.some(
    (line) => hasDateSignal(line) && !hasActionKeyword(line),
  );
  const hasActionOnlyLine = lines.some(
    (line) => hasActionKeyword(line) && !hasDateSignal(line),
  );

  const hasDateAndActionLine = lines.some(
    (line) => hasDateSignal(line) && hasActionKeyword(line),
  );

  return hasDateOnlyLine && hasActionOnlyLine && !hasDateAndActionLine;
}

function getSyllabusLines(syllabusText, limit = 1500) {
  const rawLines = syllabusText
    .replace(/\r/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 2000);
  const candidates = [];
  const seenLines = new Set();

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index];
    const cells = splitSyllabusLineIntoCells(line);

    addSyllabusLineCandidate(candidates, seenLines, line);

    if (cells.length > 1) {
      addSyllabusLineCandidate(candidates, seenLines, cells.join(" | "));

      for (const cell of cells) {
        addSyllabusLineCandidate(candidates, seenLines, cell);
      }
    }

    if (index > 0) {
      const twoLineWindow = [rawLines[index - 1], line];

      if (shouldJoinSyllabusLines(twoLineWindow)) {
        addSyllabusLineCandidate(
          candidates,
          seenLines,
          twoLineWindow.join(" | "),
        );
      }
    }

    if (index > 1) {
      const threeLineWindow = [rawLines[index - 2], rawLines[index - 1], line];

      if (shouldJoinSyllabusLines(threeLineWindow)) {
        addSyllabusLineCandidate(
          candidates,
          seenLines,
          threeLineWindow.join(" | "),
        );
      }
    }
  }

  return candidates.slice(0, limit);
}

function normalizeRequestedAnalysisMode(analysisMode) {
  return analysisMode === "rules" || analysisMode === "ai"
    ? analysisMode
    : defaultSyllabusAnalysisMode;
}

function extractSyllabusWorkload(syllabusText) {
  const lines = getSyllabusLines(syllabusText);

  for (const line of lines) {
    for (const pattern of workloadPatterns) {
      const match = line.match(pattern);

      if (!match) {
        continue;
      }

      const firstHours = Number(match[1]);
      const secondHours = match[2] ? Number(match[2]) : firstHours;

      if (
        firstHours < 0 ||
        firstHours > 80 ||
        secondHours < 0 ||
        secondHours > 80
      ) {
        continue;
      }

      const minHours = Math.min(firstHours, secondHours);
      const maxHours = Math.max(firstHours, secondHours);
      const projectedStudyHoursPerWeek =
        minHours === maxHours
          ? minHours
          : Math.round(((minHours + maxHours) / 2) * 10) / 10;

      return {
        projectedStudyHoursPerWeek,
        minHours,
        maxHours,
        sourceText: line.slice(0, 300),
        confidence: match[2] ? "high" : "medium",
      };
    }
  }

  return {
    projectedStudyHoursPerWeek: null,
    minHours: null,
    maxHours: null,
    sourceText: null,
    confidence: "low",
  };
}

function inferKeyEventType(line) {
  if (/\bno\s+class|holiday|break|cancel(?:led|ed)?\s+class\b/i.test(line)) {
    return "no_class";
  }

  if (/\bwithdraw|drop|registration|add\/drop|last\s+day\b/i.test(line)) {
    return "registration";
  }

  if (/\bexam\s+window|midterm|final|exam\b/i.test(line)) {
    return "exam";
  }

  if (/\bpresentation|conference|peer\s+review\b/i.test(line)) {
    return "course_milestone";
  }

  if (/\boffice\s+hours\b/i.test(line)) {
    return "office_hours";
  }

  return "course_event";
}

function extractSyllabusKeyEvents({
  calendarYear,
  now = new Date(),
  syllabusText,
}) {
  const lines = getSyllabusLines(syllabusText);
  const seenKeys = new Set();
  const keyEvents = [];

  for (const line of lines) {
    if (!keyEventKeywordPatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    const parsedDate = findDateInLine(line, calendarYear, now);

    if (!parsedDate) {
      continue;
    }

    const title = titleFromLine(line, parsedDate.matchText, "course_event");
    const dedupeKey = [title.toLowerCase(), parsedDate.dueAt.slice(0, 10)].join(
      "|",
    );

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    keyEvents.push({
      title,
      type: inferKeyEventType(line),
      date: parsedDate.dueAt,
      sourceText: line.slice(0, 300),
      confidence: "medium",
    });

    if (keyEvents.length >= 50) {
      break;
    }
  }

  return keyEvents;
}

function getPreviewDedupeKey(item) {
  const dueDate = item.dueAt ? item.dueAt.slice(0, 10) : "no-date";
  return [
    item.title.toLowerCase().replace(/\W+/g, " ").trim(),
    item.type,
    dueDate,
  ].join("|");
}

function mergeAiAndRuleItems(aiItems, ruleItems) {
  const mergedItems = [];
  const seenKeys = new Set();

  for (const item of [...aiItems, ...ruleItems]) {
    const dedupeKey = getPreviewDedupeKey(item);

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    mergedItems.push(item);

    if (mergedItems.length >= maxImportedItems) {
      break;
    }
  }

  return mergedItems;
}

function buildPreviewMeta({
  aiAnalysis,
  analysisMode,
  keyEvents,
  requestedAnalysisMode,
  rulePreview,
  warnings = [],
  workload,
}) {
  return {
    ...rulePreview.meta,
    analysisMode,
    requestedAnalysisMode,
    aiReaderConfigured: isAiSyllabusReaderConfigured(),
    aiModel: aiAnalysis?.model ?? null,
    aiSummary: aiAnalysis?.summary ?? null,
    analyzedCharacterCount: aiAnalysis?.analyzedCharacterCount ?? null,
    originalCharacterCount: aiAnalysis?.originalCharacterCount ?? null,
    truncatedForAi: aiAnalysis?.truncatedForAi ?? false,
    workload,
    keyEvents,
    warnings,
  };
}

async function getCourseForUser(userId, courseId) {
  const result = await query(
    `
      SELECT id, name, code, color, is_archived
      FROM courses
      WHERE id = $1 AND user_id = $2;
    `,
    [courseId, userId],
  );
  const course = result.rows[0];

  if (!course) {
    throwCourseNotFound();
  }

  return {
    id: course.id,
    name: course.name,
    code: course.code,
    color: course.color,
    isArchived: course.is_archived,
  };
}

export async function previewSyllabusCourseworkForUser(userId, syllabusData) {
  const course = await getCourseForUser(userId, syllabusData.courseId);
  const requestedAnalysisMode = normalizeRequestedAnalysisMode(
    syllabusData.analysisMode,
  );
  const rulePreview = extractSyllabusCourseworkItems({
    calendarYear: syllabusData.calendarYear,
    fileName: syllabusData.fileName,
    syllabusText: syllabusData.syllabusText,
  });
  const ruleWorkload = extractSyllabusWorkload(syllabusData.syllabusText);
  const ruleKeyEvents = extractSyllabusKeyEvents({
    calendarYear: syllabusData.calendarYear,
    syllabusText: syllabusData.syllabusText,
  });
  const warnings = [];

  if (requestedAnalysisMode === "rules") {
    return {
      course,
      fileName: syllabusData.fileName ?? null,
      items: rulePreview.items,
      meta: buildPreviewMeta({
        analysisMode: "rules",
        keyEvents: ruleKeyEvents,
        requestedAnalysisMode,
        rulePreview,
        warnings,
        workload: ruleWorkload,
      }),
    };
  }

  try {
    const aiAnalysis = await analyzeSyllabusWithAi({
      calendarYear: syllabusData.calendarYear,
      course,
      fileName: syllabusData.fileName,
      rulePreview,
      syllabusText: syllabusData.syllabusText,
    });

    if (aiAnalysis.analysisMode !== "ai") {
      warnings.push(aiAnalysis.unavailableReason);

      return {
        course,
        fileName: syllabusData.fileName ?? null,
        items: rulePreview.items,
        meta: buildPreviewMeta({
          analysisMode: "rules",
          keyEvents: ruleKeyEvents,
          requestedAnalysisMode,
          rulePreview,
          warnings,
          workload: ruleWorkload,
        }),
      };
    }

    const aiWarnings = aiAnalysis.warnings ?? [];
    const mergedItems = mergeAiAndRuleItems(
      aiAnalysis.items,
      rulePreview.items,
    );

    if (mergedItems.length > aiAnalysis.items.length) {
      aiWarnings.push(
        "Local parser added extra dated items not returned by the AI reader.",
      );
    }

    return {
      course,
      fileName: syllabusData.fileName ?? null,
      items: mergedItems,
      meta: buildPreviewMeta({
        aiAnalysis,
        analysisMode: "ai",
        keyEvents:
          aiAnalysis.keyEvents.length > 0
            ? aiAnalysis.keyEvents
            : ruleKeyEvents,
        requestedAnalysisMode,
        rulePreview,
        warnings: aiWarnings,
        workload: aiAnalysis.workload ?? ruleWorkload,
      }),
    };
  } catch (error) {
    if (requestedAnalysisMode === "ai") {
      warnings.push(
        "AI syllabus reader failed; local parser was used instead.",
      );
    } else {
      warnings.push(
        "AI syllabus reader was unavailable; local parser was used instead.",
      );
    }

    return {
      course,
      fileName: syllabusData.fileName ?? null,
      items: rulePreview.items,
      meta: buildPreviewMeta({
        analysisMode: "rules",
        keyEvents: ruleKeyEvents,
        requestedAnalysisMode,
        rulePreview,
        warnings,
        workload: ruleWorkload,
      }),
    };
  }
}

export async function previewUploadedSyllabusCourseworkForUser(
  userId,
  syllabusData,
  file,
) {
  if (!file) {
    throw badRequest("Syllabus file is required.");
  }

  const fileName = syllabusData.fileName ?? file.originalname;
  const syllabusText = await extractTextFromSyllabusFile(file);
  assertExtractedSyllabusText(syllabusText);

  return previewSyllabusCourseworkForUser(userId, {
    ...syllabusData,
    fileName,
    syllabusText,
  });
}

async function findDuplicateCoursework(client, userId, courseId, item) {
  const result = await client.query(
    `
      SELECT id, title
      FROM coursework
      WHERE user_id = $1
        AND course_id = $2
        AND lower(title) = lower($3)
        AND due_at = $4::timestamptz
      LIMIT 1;
    `,
    [userId, courseId, item.title, item.dueAt],
  );

  return result.rows[0] ?? null;
}

async function insertImportedCoursework(client, userId, courseId, item) {
  const result = await client.query(
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
        grade_weight,
        topic,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id;
    `,
    [
      userId,
      courseId,
      item.title,
      item.description ?? null,
      item.type,
      item.dueAt,
      item.priority,
      item.difficulty,
      item.estimatedMinutes,
      item.gradeWeight ?? null,
      item.topic ?? null,
      item.notes ?? null,
    ],
  );

  return result.rows[0].id;
}

export async function importSyllabusCourseworkForUser(userId, importData) {
  const course = await getCourseForUser(userId, importData.courseId);

  if (importData.items.length > maxImportedItems) {
    throw badRequest(
      "At most " +
        maxImportedItems +
        " syllabus items can be imported at once.",
    );
  }

  const result = await transaction(async (client) => {
    const importedIds = [];
    const duplicates = [];

    for (const item of importData.items) {
      const duplicate = await findDuplicateCoursework(
        client,
        userId,
        importData.courseId,
        item,
      );

      if (duplicate) {
        duplicates.push({
          existingCourseworkId: duplicate.id,
          title: item.title,
          dueAt: item.dueAt,
        });
        continue;
      }

      const insertedId = await insertImportedCoursework(
        client,
        userId,
        importData.courseId,
        item,
      );
      importedIds.push(insertedId);
    }

    return { duplicates, importedIds };
  });

  const importedCoursework = await Promise.all(
    result.importedIds.map((courseworkId) =>
      getCourseworkForUser(userId, courseworkId),
    ),
  );

  return {
    course,
    importedCoursework,
    duplicates: result.duplicates,
    summary: {
      requestedCount: importData.items.length,
      importedCount: importedCoursework.length,
      duplicateCount: result.duplicates.length,
    },
  };
}
