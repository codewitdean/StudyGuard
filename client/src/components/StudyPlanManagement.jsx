import { useEffect, useMemo, useState } from "react";
import {
  approveStudyPlan,
  archiveStudyPlan,
  generateStudyPlan,
  getStudyPlan,
  listStudyPlans,
} from "../api/studyPlanApi.js";

const planningPriorityOptions = [
  { label: "Use Profile Priority", value: "" },
  { label: "Meet Deadlines", value: "meet_deadlines" },
  { label: "Prevent Burnout", value: "prevent_burnout" },
  {
    label: "Balance Deadlines + Wellbeing",
    value: "balance_deadlines_wellbeing",
  },
  { label: "Custom", value: "custom" },
];

const planStatusFilterOptions = [
  { label: "Current", value: "current" },
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" },
];

const statusStyles = {
  draft: "bg-amber-50 text-amber-800",
  active: "bg-emerald-50 text-emerald-800",
  archived: "bg-slate-100 text-slate-700",
};

const overloadStyles = {
  unknown: "bg-slate-100 text-slate-700",
  balanced: "bg-emerald-50 text-emerald-800",
  heavy: "bg-amber-50 text-amber-800",
  overloaded: "bg-red-50 text-red-800",
};

const initialPlanFilters = {
  status: "current",
  from: "",
  to: "",
};

function getTodayDate() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + days);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getInitialGenerateFormData() {
  const startDate = getTodayDate();

  return {
    startDate,
    endDate: addDays(startDate, 6),
    planningPriority: "",
  };
}

function formatFieldName(field) {
  return field
    .replace("body.", "")
    .replace("params.", "")
    .replace("query.", "");
}

function getErrorForField(fieldErrors, fieldName) {
  return fieldErrors.find((error) => error.field === "body." + fieldName);
}

function formatOptionLabel(value) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMinutes(minutes) {
  if (!minutes) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return minutes + "m";
  }

  if (remainingMinutes === 0) {
    return hours + "h";
  }

  return hours + "h " + remainingMinutes + "m";
}

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(dateString + "T00:00:00"));
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getBlockMinutes(block) {
  if (!block.startAt || !block.endAt) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) /
        60000,
    ),
  );
}

function getBlockDateKey(block) {
  if (!block.startAt) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(block.startAt));
}

function buildGeneratePayload(formData) {
  const payload = {};

  if (formData.startDate) {
    payload.startDate = formData.startDate;
  }

  if (formData.endDate) {
    payload.endDate = formData.endDate;
  }

  if (formData.planningPriority) {
    payload.planningPriority = formData.planningPriority;
  }

  return payload;
}

function TextInput({ error, id, label, ...props }) {
  return (
    <label
      className="grid gap-2 text-sm font-medium text-slate-700"
      htmlFor={id}
    >
      <span>{label}</span>
      <input
        aria-describedby={error ? id + "-error" : undefined}
        aria-invalid={Boolean(error)}
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        id={id}
        {...props}
      />
      {error ? (
        <span className="text-xs font-medium text-red-700" id={id + "-error"}>
          {error.message}
        </span>
      ) : null}
    </label>
  );
}

function SelectInput({ children, error, id, label, ...props }) {
  return (
    <label
      className="grid gap-2 text-sm font-medium text-slate-700"
      htmlFor={id}
    >
      <span>{label}</span>
      <select
        aria-describedby={error ? id + "-error" : undefined}
        aria-invalid={Boolean(error)}
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        id={id}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span className="text-xs font-medium text-red-700" id={id + "-error"}>
          {error.message}
        </span>
      ) : null}
    </label>
  );
}

function ErrorPanel({ fieldErrors, formError }) {
  if (!formError) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      <p>{formError}</p>
      {fieldErrors.length > 1 ? (
        <ul className="mt-2 grid gap-1">
          {fieldErrors.map((error) => (
            <li key={error.field}>
              {formatFieldName(error.field)}: {error.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (statusStyles[status] ?? "bg-slate-100 text-slate-700")
      }
    >
      {formatOptionLabel(status)}
    </span>
  );
}

function OverloadBadge({ overloadStatus }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (overloadStyles[overloadStatus] ?? "bg-slate-100 text-slate-700")
      }
    >
      {formatOptionLabel(overloadStatus)}
    </span>
  );
}

function GeneratePlanForm({
  fieldErrors,
  formData,
  formError,
  isGenerating,
  onChange,
  onReset,
  onSubmit,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">
          Generate
        </p>
        <h3 className="mt-1 text-xl font-semibold">Draft Study Plan</h3>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
          <TextInput
            error={getErrorForField(fieldErrors, "startDate")}
            id="study-plan-start-date"
            label="Start"
            name="startDate"
            onChange={onChange}
            type="date"
            value={formData.startDate}
          />
          <TextInput
            error={getErrorForField(fieldErrors, "endDate")}
            id="study-plan-end-date"
            label="End"
            name="endDate"
            onChange={onChange}
            type="date"
            value={formData.endDate}
          />
        </div>

        <SelectInput
          error={getErrorForField(fieldErrors, "planningPriority")}
          id="study-plan-priority"
          label="Priority"
          name="planningPriority"
          onChange={onChange}
          value={formData.planningPriority}
        >
          {planningPriorityOptions.map((option) => (
            <option key={option.value || "profile"} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>

        <ErrorPanel fieldErrors={fieldErrors} formError={formError} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
            disabled={isGenerating}
            type="submit"
          >
            {isGenerating ? "Generating..." : "Generate Draft"}
          </button>
          <button
            className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-28"
            disabled={isGenerating}
            onClick={onReset}
            type="button"
          >
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}

function PlanFilters({ filters, isLoading, onChange, onRefresh }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">Plans</p>
        <h3 className="mt-1 text-xl font-semibold">Saved Drafts</h3>
      </div>

      <div className="mt-5 grid gap-4">
        <SelectInput
          id="study-plan-filter-status"
          label="Status"
          name="status"
          onChange={onChange}
          value={filters.status}
        >
          {planStatusFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
          <TextInput
            id="study-plan-filter-from"
            label="From"
            name="from"
            onChange={onChange}
            type="date"
            value={filters.from}
          />
          <TextInput
            id="study-plan-filter-to"
            label="To"
            name="to"
            onChange={onChange}
            type="date"
            value={filters.to}
          />
        </div>

        <button
          className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          {isLoading ? "Refreshing..." : "Refresh Plans"}
        </button>
      </div>
    </section>
  );
}

function PlanList({ activePlanId, isLoading, onArchive, onSelect, plans }) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        Loading study plans.
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        No study plans found.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {plans.map((plan) => {
        const isActive = plan.id === activePlanId;

        return (
          <div
            className={
              "rounded-md border bg-white p-3 transition " +
              (isActive ? "border-emerald-300" : "border-slate-200")
            }
            key={plan.id}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                className="grid flex-1 gap-1 text-left"
                onClick={() => onSelect(plan.id)}
                type="button"
              >
                <span className="text-sm font-semibold text-slate-950">
                  {formatDate(plan.planStartDate)} -{" "}
                  {formatDate(plan.planEndDate)}
                </span>
                <span className="text-xs text-slate-500">
                  {formatMinutes(plan.summary?.scheduledMinutes ?? 0)} scheduled
                </span>
              </button>
              <StatusBadge status={plan.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={() => onSelect(plan.id)}
                type="button"
              >
                Open
              </button>
              {plan.status !== "archived" ? (
                <button
                  className="h-8 rounded-md border border-red-200 px-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                  onClick={() => onArchive(plan.id)}
                  type="button"
                >
                  Archive
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlanSummary({ planDetail }) {
  const { studyPlan, summary } = planDetail;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            {studyPlan.status}
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            {formatDate(studyPlan.planStartDate)} -{" "}
            {formatDate(studyPlan.planEndDate)}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {formatOptionLabel(studyPlan.planningPriority)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={studyPlan.status} />
          <OverloadBadge overloadStatus={summary.overloadStatus} />
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryStat
          label="Available"
          value={formatMinutes(summary.availableMinutes)}
        />
        <SummaryStat
          label="Required"
          value={formatMinutes(summary.requiredMinutes)}
        />
        <SummaryStat
          label="Scheduled"
          value={formatMinutes(summary.scheduledMinutes)}
        />
        <SummaryStat
          label="Unscheduled"
          value={formatMinutes(summary.unscheduledMinutes)}
        />
        <SummaryStat label="Blocks" value={summary.studyBlockCount ?? 0} />
        <SummaryStat label="Days" value={summary.studyDayCount ?? 0} />
      </div>
    </section>
  );
}

function WarningList({ warnings }) {
  if (!warnings.length) {
    return null;
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
      <p className="font-semibold">Warnings</p>
      <ul className="mt-3 grid gap-2">
        {warnings.map((warning) => (
          <li key={warning.code}>
            <span className="font-semibold">
              {formatOptionLabel(warning.code)}:
            </span>{" "}
            {warning.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnscheduledList({ unscheduledCoursework }) {
  if (!unscheduledCoursework.length) {
    return null;
  }

  return (
    <section className="rounded-lg border border-red-100 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-red-700">
          Unscheduled
        </p>
        <h3 className="mt-1 text-xl font-semibold">Remaining Work</h3>
      </div>
      <div className="mt-4 grid gap-3">
        {unscheduledCoursework.map((item) => (
          <div className="rounded-md border border-red-100 p-3" key={item.id}>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <p className="font-semibold text-slate-950">{item.title}</p>
              <span className="text-sm font-semibold text-red-700">
                {formatMinutes(item.remainingMinutes)} left
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanActions({ isUpdating, onApprove, onArchive, studyPlan }) {
  if (studyPlan.status === "archived") {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        {studyPlan.status === "draft" ? (
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
            disabled={isUpdating}
            onClick={onApprove}
            type="button"
          >
            {isUpdating ? "Updating..." : "Approve Plan"}
          </button>
        ) : null}
        <button
          className="h-10 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:flex-1"
          disabled={isUpdating}
          onClick={onArchive}
          type="button"
        >
          Archive Plan
        </button>
      </div>
    </section>
  );
}

function StudyBlocksTable({ studyBlocks }) {
  if (studyBlocks.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No study blocks were scheduled.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">
          Schedule
        </p>
        <h3 className="mt-1 text-xl font-semibold">Study Blocks</h3>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                Date
              </th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                Time
              </th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                Coursework
              </th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                Duration
              </th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                Why
              </th>
            </tr>
          </thead>
          <tbody>
            {studyBlocks.map((block) => (
              <tr className="align-top" key={block.id}>
                <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">
                  {getBlockDateKey(block)}
                </td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                  {formatDateTime(block.startAt)} -{" "}
                  {formatDateTime(block.endAt)}
                </td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                  <span className="font-semibold text-slate-950">
                    {block.coursework?.title ?? "Study block"}
                  </span>
                  {block.coursework?.course ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      {[
                        block.coursework.course.code,
                        block.coursework.course.name,
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </span>
                  ) : null}
                </td>
                <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                  {formatMinutes(getBlockMinutes(block))}
                </td>
                <td className="max-w-sm border-b border-slate-100 px-3 py-3 text-slate-600">
                  {block.explanation ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyPlanDetail() {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
      Generate a draft or open a saved plan.
    </section>
  );
}

export default function StudyPlanManagement({ authToken, onAuthExpired }) {
  const [generateFormData, setGenerateFormData] = useState(
    getInitialGenerateFormData,
  );
  const [planFilters, setPlanFilters] = useState(initialPlanFilters);
  const [plans, setPlans] = useState([]);
  const [activePlanDetail, setActivePlanDetail] = useState(null);
  const [fieldErrors, setFieldErrors] = useState([]);
  const [formError, setFormError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  const activePlanId = activePlanDetail?.studyPlan?.id ?? "";
  const groupedStudyBlocks = useMemo(() => {
    if (!activePlanDetail) {
      return [];
    }

    return activePlanDetail.studyBlocks;
  }, [activePlanDetail]);

  async function loadPlans(filters = planFilters, { silent = false } = {}) {
    if (!authToken) {
      return;
    }

    if (!silent) {
      setIsLoadingPlans(true);
    }

    try {
      const data = await listStudyPlans(authToken, filters);
      setPlans(data.studyPlans);
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      if (!silent) {
        setIsLoadingPlans(false);
      }
    }
  }

  async function loadPlanDetail(studyPlanId) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    setIsLoadingDetail(true);
    setFormError("");
    setFieldErrors([]);
    setStatusMessage("");

    try {
      const data = await getStudyPlan(authToken, studyPlanId);
      setActivePlanDetail(data);
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setIsLoadingDetail(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialPlans() {
      if (!authToken) {
        return;
      }

      setIsLoadingPlans(true);
      setFormError("");
      setFieldErrors([]);

      try {
        const data = await listStudyPlans(authToken, planFilters);

        if (!isCurrent) {
          return;
        }

        setPlans(data.studyPlans);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        if (error.statusCode === 401) {
          onAuthExpired();
          return;
        }

        setFormError(error.message);
        setFieldErrors(error.details ?? []);
      } finally {
        if (isCurrent) {
          setIsLoadingPlans(false);
        }
      }
    }

    loadInitialPlans();

    return () => {
      isCurrent = false;
    };
  }, [authToken, onAuthExpired, planFilters]);

  function handleGenerateFormChange(event) {
    const { name, value } = event.target;

    setGenerateFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handlePlanFilterChange(event) {
    const { name, value } = event.target;

    setPlanFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
    setFormError("");
    setFieldErrors([]);
    setStatusMessage("");
  }

  function resetGenerateForm() {
    setGenerateFormData(getInitialGenerateFormData());
    setFormError("");
    setFieldErrors([]);
  }

  async function handleGenerateSubmit(event) {
    event.preventDefault();

    if (!authToken) {
      onAuthExpired();
      return;
    }

    setIsGenerating(true);
    setFormError("");
    setFieldErrors([]);
    setStatusMessage("");

    try {
      const data = await generateStudyPlan(
        authToken,
        buildGeneratePayload(generateFormData),
      );
      setActivePlanDetail(data);
      setStatusMessage("Draft study plan generated.");
      await loadPlans(planFilters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleApprovePlan() {
    if (!activePlanId) {
      return;
    }

    setIsUpdatingPlan(true);
    setFormError("");
    setFieldErrors([]);
    setStatusMessage("");

    try {
      const data = await approveStudyPlan(authToken, activePlanId);
      setActivePlanDetail(data);
      setStatusMessage("Study plan approved.");
      await loadPlans(planFilters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setIsUpdatingPlan(false);
    }
  }

  async function handleArchivePlan(studyPlanId = activePlanId) {
    if (!studyPlanId) {
      return;
    }

    const confirmed = window.confirm("Archive this study plan?");

    if (!confirmed) {
      return;
    }

    setIsUpdatingPlan(true);
    setFormError("");
    setFieldErrors([]);
    setStatusMessage("");

    try {
      const data = await archiveStudyPlan(authToken, studyPlanId);

      if (studyPlanId === activePlanId) {
        setActivePlanDetail(data);
      }

      setStatusMessage("Study plan archived.");
      await loadPlans(planFilters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setIsUpdatingPlan(false);
    }
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <GeneratePlanForm
          fieldErrors={fieldErrors}
          formData={generateFormData}
          formError={formError}
          isGenerating={isGenerating}
          onChange={handleGenerateFormChange}
          onReset={resetGenerateForm}
          onSubmit={handleGenerateSubmit}
        />
        <PlanFilters
          filters={planFilters}
          isLoading={isLoadingPlans}
          onChange={handlePlanFilterChange}
          onRefresh={() => loadPlans(planFilters)}
        />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <PlanList
            activePlanId={activePlanId}
            isLoading={isLoadingPlans}
            onArchive={handleArchivePlan}
            onSelect={loadPlanDetail}
            plans={plans}
          />
        </section>
      </div>

      <div className="grid content-start gap-4">
        {statusMessage ? (
          <div
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {statusMessage}
          </div>
        ) : null}

        {isLoadingDetail ? (
          <section className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
            Loading study plan.
          </section>
        ) : activePlanDetail ? (
          <>
            <PlanSummary planDetail={activePlanDetail} />
            <PlanActions
              isUpdating={isUpdatingPlan}
              onApprove={handleApprovePlan}
              onArchive={() => handleArchivePlan(activePlanId)}
              studyPlan={activePlanDetail.studyPlan}
            />
            <WarningList warnings={activePlanDetail.warnings ?? []} />
            <UnscheduledList
              unscheduledCoursework={
                activePlanDetail.unscheduledCoursework ?? []
              }
            />
            <StudyBlocksTable studyBlocks={groupedStudyBlocks} />
          </>
        ) : (
          <EmptyPlanDetail />
        )}
      </div>
    </div>
  );
}
