# Stage 20: AI Syllabus Reader

Status: implementation complete, browser QA pending.

## Goal

Add a smart syllabus reader that can understand uploaded PDF, Word .docx, text, Markdown, and CSV syllabi beyond simple date matching. The reader should identify projected study hours, assigned dates, due dates, quizzes, tests, assignments, course calendar rows, and key course events before the student imports anything.

## Backend

- Added the optional OpenAI SDK dependency in the server workspace.
- Added `server/src/services/aiSyllabusReaderService.js` for structured syllabus analysis.
- The AI reader uses the Responses API with strict JSON schema output for coursework items, workload expectations, key events, and warnings.
- `OPENAI_API_KEY` enables smart AI analysis. `SYLLABUS_AI_MODEL` and `SYLLABUS_AI_MAX_CHARS` tune model choice and maximum prompt size.
- The preview endpoint accepts `analysisMode`: `auto`, `ai`, or `rules`.
- `auto` tries the AI reader when configured and falls back to the local parser when no API key is present or the AI call fails.
- The local parser now also extracts simple workload expectations and key events, so local development remains useful without an AI key.
- Large extracted syllabus text is reduced to the beginning, ending, and date/workload-heavy sections before AI analysis.
- Stage 21 improves table and calendar-row extraction after real syllabus testing showed the first reader was not reading syllabus data well enough.

## Frontend

- Added a Reader selector to the Syllabus Upload panel.
- Added a preview summary showing the active reader, projected study time, key event count, key event dates, and warnings.
- Coursework suggestions still remain editable and selectable before import.
- Import behavior is unchanged: StudyGuard only creates coursework after the student confirms selected preview rows.

## Summer-To-Fall QA Strategy

Use completed Summer 2026 syllabi and completed coursework as the truth set. Upload summer syllabi, compare the AI reader output against the actual completed summer tasks, then tune prompts, workload defaults, due-date parsing, assignment-date parsing, and duplicate handling before relying on the reader for Fall 2026 planning.

## Configuration

```text
OPENAI_API_KEY=your-api-key
SYLLABUS_AI_MODEL=gpt-4.1-mini
SYLLABUS_AI_MAX_CHARS=70000
```

`OPENAI_API_KEY` should stay on the backend only. The browser never needs access to it.

## Verification

- Server route tests cover local workload extraction, key event extraction, and fallback when smart analysis has no API key.
- Existing syllabus preview/import behavior remains covered by route tests.

## Change Log

### August 20, 2026

- Added optional AI syllabus reader service.
- Added structured extraction for projected study hours, assigned dates, due dates, coursework, key events, confidence, source text, and warnings.
- Added AI fallback behavior for local development.
- Added Reader selector and analysis summary to the Coursework screen.
- Added Stage 20 documentation and README setup notes.
- Added Stage 21 handoff note after real syllabus testing exposed calendar extraction gaps.
