import { useEffect, useState } from "react";
import {
  createAvailabilityException,
  createWeeklyAvailability,
  deleteAvailabilityException,
  deleteWeeklyAvailability,
  listAvailabilityExceptions,
  listWeeklyAvailability,
  updateAvailabilityException,
  updateWeeklyAvailability,
} from "../api/availabilityApi.js";

const weekdayOptions = [
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
  { label: "Sunday", value: "7" },
];

const exceptionTypeOptions = [
  { label: "Unavailable", value: "unavailable" },
  { label: "Extra Available", value: "extra_available" },
];

const exceptionTypeFilterOptions = [
  { label: "All Types", value: "all" },
  ...exceptionTypeOptions,
];

const initialWeeklyFilter = {
  weekday: "all",
};

const initialWeeklyFormData = {
  weekday: "1",
  startTime: "18:00",
  endTime: "21:00",
  label: "",
};

const initialExceptionFilters = {
  from: "",
  to: "",
  type: "all",
};

function getTodayDate() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getInitialExceptionFormData() {
  return {
    exceptionDate: getTodayDate(),
    type: "unavailable",
    isFullDay: false,
    startTime: "14:00",
    endTime: "16:00",
    reason: "",
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

function getWeekdayLabel(weekday) {
  return (
    weekdayOptions.find((option) => option.value === String(weekday))?.label ??
    "Day " + weekday
  );
}

function getExceptionTypeLabel(type) {
  return (
    exceptionTypeOptions.find((option) => option.value === type)?.label ?? type
  );
}

function parseTimeMinutes(value) {
  if (!value) {
    return 0;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
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

function getWindowDuration(availabilityWindow) {
  return Math.max(
    0,
    parseTimeMinutes(availabilityWindow.endTime) -
      parseTimeMinutes(availabilityWindow.startTime),
  );
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) {
    return "Full day";
  }

  return startTime + " - " + endTime;
}

function formatExceptionDate(exceptionDate) {
  if (!exceptionDate) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(exceptionDate + "T00:00:00"));
}

function getAvailabilityExceptionPayload(formData) {
  if (formData.isFullDay) {
    return {
      exceptionDate: formData.exceptionDate,
      type: formData.type,
      isFullDay: true,
      startTime: null,
      endTime: null,
      reason: formData.reason,
    };
  }

  return {
    ...formData,
    isFullDay: false,
  };
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

function TypeBadge({ type }) {
  const isExtra = type === "extra_available";

  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (isExtra ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")
      }
    >
      {getExceptionTypeLabel(type)}
    </span>
  );
}

function WeeklyAvailabilityForm({
  editingWeeklyId,
  fieldErrors,
  formData,
  formError,
  isSaving,
  onCancelEdit,
  onChange,
  onSubmit,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">
          {editingWeeklyId ? "Edit Weekly Window" : "New Weekly Window"}
        </p>
        <h3 className="mt-1 text-xl font-semibold">
          {editingWeeklyId ? "Update Study Window" : "Create Study Window"}
        </h3>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <SelectInput
          error={getErrorForField(fieldErrors, "weekday")}
          id="weekly-weekday"
          label="Weekday"
          name="weekday"
          onChange={onChange}
          value={formData.weekday}
        >
          {weekdayOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            error={getErrorForField(fieldErrors, "startTime")}
            id="weekly-start-time"
            label="Start"
            name="startTime"
            onChange={onChange}
            required
            type="time"
            value={formData.startTime}
          />
          <TextInput
            error={getErrorForField(fieldErrors, "endTime")}
            id="weekly-end-time"
            label="End"
            name="endTime"
            onChange={onChange}
            required
            type="time"
            value={formData.endTime}
          />
        </div>

        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "label")}
          id="weekly-label"
          label="Label"
          maxLength={80}
          name="label"
          onChange={onChange}
          placeholder="Library time"
          type="text"
          value={formData.label}
        />

        <ErrorPanel fieldErrors={fieldErrors} formError={formError} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? "Saving..."
              : editingWeeklyId
                ? "Update Window"
                : "Create Window"}
          </button>
          {editingWeeklyId ? (
            <button
              className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-28"
              disabled={isSaving}
              onClick={onCancelEdit}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ExceptionForm({
  editingExceptionId,
  fieldErrors,
  formData,
  formError,
  isSaving,
  onCancelEdit,
  onChange,
  onFullDayChange,
  onSubmit,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">
          {editingExceptionId ? "Edit Exception" : "New Exception"}
        </p>
        <h3 className="mt-1 text-xl font-semibold">
          {editingExceptionId
            ? "Update One-Time Change"
            : "Create One-Time Change"}
        </h3>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <TextInput
          error={getErrorForField(fieldErrors, "exceptionDate")}
          id="exception-date"
          label="Date"
          name="exceptionDate"
          onChange={onChange}
          required
          type="date"
          value={formData.exceptionDate}
        />

        <SelectInput
          error={getErrorForField(fieldErrors, "type")}
          id="exception-type"
          label="Type"
          name="type"
          onChange={onChange}
          value={formData.type}
        >
          {exceptionTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>

        <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
          <input
            checked={formData.isFullDay}
            className="h-4 w-4 accent-emerald-700"
            name="isFullDay"
            onChange={onFullDayChange}
            type="checkbox"
          />
          <span>Full day</span>
        </label>

        {formData.isFullDay ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              error={getErrorForField(fieldErrors, "startTime")}
              id="exception-start-time"
              label="Start"
              name="startTime"
              onChange={onChange}
              required={!formData.isFullDay}
              type="time"
              value={formData.startTime}
            />
            <TextInput
              error={getErrorForField(fieldErrors, "endTime")}
              id="exception-end-time"
              label="End"
              name="endTime"
              onChange={onChange}
              required={!formData.isFullDay}
              type="time"
              value={formData.endTime}
            />
          </div>
        )}

        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "reason")}
          id="exception-reason"
          label="Reason"
          maxLength={160}
          name="reason"
          onChange={onChange}
          placeholder="Work shift"
          type="text"
          value={formData.reason}
        />

        <ErrorPanel fieldErrors={fieldErrors} formError={formError} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? "Saving..."
              : editingExceptionId
                ? "Update Change"
                : "Create Change"}
          </button>
          {editingExceptionId ? (
            <button
              className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-28"
              disabled={isSaving}
              onClick={onCancelEdit}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function WeeklyFilters({ filter, isLoading, onChange, onRefresh }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end">
      <SelectInput
        id="weekly-filter-weekday"
        label="Day"
        name="weekday"
        onChange={onChange}
        value={filter.weekday}
      >
        <option value="all">All Days</option>
        {weekdayOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>
      <button
        className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        disabled={isLoading}
        onClick={onRefresh}
        type="button"
      >
        {isLoading ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  );
}

function WeeklyRows({
  deletingWeeklyId,
  onDeleteWeekly,
  onEditWeekly,
  weeklyAvailability,
}) {
  if (weeklyAvailability.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        No weekly study windows found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Day
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Window
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Duration
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Label
            </th>
            <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {weeklyAvailability.map((availabilityWindow) => (
            <tr className="align-top" key={availabilityWindow.id}>
              <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">
                {getWeekdayLabel(availabilityWindow.weekday)}
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {formatTimeRange(
                  availabilityWindow.startTime,
                  availabilityWindow.endTime,
                )}
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {formatMinutes(getWindowDuration(availabilityWindow))}
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {availabilityWindow.label ?? "-"}
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    onClick={() => onEditWeekly(availabilityWindow)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="h-8 rounded-md border border-red-200 px-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={deletingWeeklyId === availabilityWindow.id}
                    onClick={() => onDeleteWeekly(availabilityWindow)}
                    type="button"
                  >
                    {deletingWeeklyId === availabilityWindow.id
                      ? "Deleting"
                      : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeeklyList({
  deletingWeeklyId,
  filter,
  isLoading,
  onDeleteWeekly,
  onEditWeekly,
  onFilterChange,
  onRefresh,
  statusMessage,
  weeklyAvailability,
}) {
  const totalMinutes = weeklyAvailability.reduce(
    (total, availabilityWindow) =>
      total + getWindowDuration(availabilityWindow),
    0,
  );
  const activeDays = new Set(
    weeklyAvailability.map((availabilityWindow) => availabilityWindow.weekday),
  ).size;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Weekly Template
          </p>
          <h3 className="mt-1 text-xl font-semibold">Study Windows</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryStat label="Visible" value={weeklyAvailability.length} />
          <SummaryStat label="Days" value={activeDays} />
          <SummaryStat label="Time" value={formatMinutes(totalMinutes)} />
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <WeeklyFilters
          filter={filter}
          isLoading={isLoading}
          onChange={onFilterChange}
          onRefresh={onRefresh}
        />

        {statusMessage ? (
          <div
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {statusMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-md border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Loading weekly availability.
          </div>
        ) : (
          <WeeklyRows
            deletingWeeklyId={deletingWeeklyId}
            onDeleteWeekly={onDeleteWeekly}
            onEditWeekly={onEditWeekly}
            weeklyAvailability={weeklyAvailability}
          />
        )}
      </div>
    </section>
  );
}

function ExceptionFilters({ filters, isLoading, onChange, onRefresh }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
      <TextInput
        id="exception-filter-from"
        label="From"
        name="from"
        onChange={onChange}
        type="date"
        value={filters.from}
      />
      <TextInput
        id="exception-filter-to"
        label="To"
        name="to"
        onChange={onChange}
        type="date"
        value={filters.to}
      />
      <SelectInput
        id="exception-filter-type"
        label="Type"
        name="type"
        onChange={onChange}
        value={filters.type}
      >
        {exceptionTypeFilterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>
      <button
        className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        disabled={isLoading}
        onClick={onRefresh}
        type="button"
      >
        {isLoading ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  );
}

function ExceptionRows({
  availabilityExceptions,
  deletingExceptionId,
  onDeleteException,
  onEditException,
}) {
  if (availabilityExceptions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        No one-time changes found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Date
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Type
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Time
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Reason
            </th>
            <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {availabilityExceptions.map((exception) => (
            <tr className="align-top" key={exception.id}>
              <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">
                {formatExceptionDate(exception.exceptionDate)}
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <TypeBadge type={exception.type} />
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {exception.isFullDay
                  ? "Full day"
                  : formatTimeRange(exception.startTime, exception.endTime)}
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {exception.reason ?? "-"}
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    onClick={() => onEditException(exception)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="h-8 rounded-md border border-red-200 px-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={deletingExceptionId === exception.id}
                    onClick={() => onDeleteException(exception)}
                    type="button"
                  >
                    {deletingExceptionId === exception.id
                      ? "Deleting"
                      : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExceptionList({
  availabilityExceptions,
  deletingExceptionId,
  filters,
  isLoading,
  onDeleteException,
  onEditException,
  onFilterChange,
  onRefresh,
  statusMessage,
}) {
  const fullDayCount = availabilityExceptions.filter(
    (exception) => exception.isFullDay,
  ).length;
  const extraCount = availabilityExceptions.filter(
    (exception) => exception.type === "extra_available",
  ).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            One-Time Changes
          </p>
          <h3 className="mt-1 text-xl font-semibold">Exceptions</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryStat label="Visible" value={availabilityExceptions.length} />
          <SummaryStat label="Full Day" value={fullDayCount} />
          <SummaryStat label="Extra" value={extraCount} />
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <ExceptionFilters
          filters={filters}
          isLoading={isLoading}
          onChange={onFilterChange}
          onRefresh={onRefresh}
        />

        {statusMessage ? (
          <div
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {statusMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-md border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Loading one-time changes.
          </div>
        ) : (
          <ExceptionRows
            availabilityExceptions={availabilityExceptions}
            deletingExceptionId={deletingExceptionId}
            onDeleteException={onDeleteException}
            onEditException={onEditException}
          />
        )}
      </div>
    </section>
  );
}

export default function AvailabilityManagement({ authToken, onAuthExpired }) {
  const [weeklyAvailability, setWeeklyAvailability] = useState([]);
  const [availabilityExceptions, setAvailabilityExceptions] = useState([]);
  const [weeklyFilter, setWeeklyFilter] = useState(initialWeeklyFilter);
  const [exceptionFilters, setExceptionFilters] = useState(
    initialExceptionFilters,
  );
  const [weeklyFormData, setWeeklyFormData] = useState(initialWeeklyFormData);
  const [exceptionFormData, setExceptionFormData] = useState(
    getInitialExceptionFormData,
  );
  const [editingWeeklyId, setEditingWeeklyId] = useState("");
  const [editingExceptionId, setEditingExceptionId] = useState("");
  const [weeklyFieldErrors, setWeeklyFieldErrors] = useState([]);
  const [exceptionFieldErrors, setExceptionFieldErrors] = useState([]);
  const [weeklyFormError, setWeeklyFormError] = useState("");
  const [exceptionFormError, setExceptionFormError] = useState("");
  const [weeklyStatusMessage, setWeeklyStatusMessage] = useState("");
  const [exceptionStatusMessage, setExceptionStatusMessage] = useState("");
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);
  const [isLoadingExceptions, setIsLoadingExceptions] = useState(false);
  const [isSavingWeekly, setIsSavingWeekly] = useState(false);
  const [isSavingException, setIsSavingException] = useState(false);
  const [deletingWeeklyId, setDeletingWeeklyId] = useState("");
  const [deletingExceptionId, setDeletingExceptionId] = useState("");

  async function loadWeeklyAvailability(
    filter = weeklyFilter,
    { silent = false } = {},
  ) {
    if (!authToken) {
      return;
    }

    if (!silent) {
      setIsLoadingWeekly(true);
    }

    try {
      const data = await listWeeklyAvailability(authToken, filter);
      setWeeklyAvailability(data.weeklyAvailability);
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setWeeklyFormError(error.message);
      setWeeklyFieldErrors(error.details ?? []);
    } finally {
      if (!silent) {
        setIsLoadingWeekly(false);
      }
    }
  }

  async function loadAvailabilityExceptions(
    filters = exceptionFilters,
    { silent = false } = {},
  ) {
    if (!authToken) {
      return;
    }

    if (!silent) {
      setIsLoadingExceptions(true);
    }

    try {
      const data = await listAvailabilityExceptions(authToken, filters);
      setAvailabilityExceptions(data.availabilityExceptions);
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setExceptionFormError(error.message);
      setExceptionFieldErrors(error.details ?? []);
    } finally {
      if (!silent) {
        setIsLoadingExceptions(false);
      }
    }
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialWeeklyAvailability() {
      if (!authToken) {
        return;
      }

      setIsLoadingWeekly(true);
      setWeeklyFormError("");
      setWeeklyFieldErrors([]);

      try {
        const data = await listWeeklyAvailability(authToken, weeklyFilter);

        if (!isCurrent) {
          return;
        }

        setWeeklyAvailability(data.weeklyAvailability);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        if (error.statusCode === 401) {
          onAuthExpired();
          return;
        }

        setWeeklyFormError(error.message);
        setWeeklyFieldErrors(error.details ?? []);
      } finally {
        if (isCurrent) {
          setIsLoadingWeekly(false);
        }
      }
    }

    loadInitialWeeklyAvailability();

    return () => {
      isCurrent = false;
    };
  }, [authToken, onAuthExpired, weeklyFilter]);

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialExceptions() {
      if (!authToken) {
        return;
      }

      setIsLoadingExceptions(true);
      setExceptionFormError("");
      setExceptionFieldErrors([]);

      try {
        const data = await listAvailabilityExceptions(
          authToken,
          exceptionFilters,
        );

        if (!isCurrent) {
          return;
        }

        setAvailabilityExceptions(data.availabilityExceptions);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        if (error.statusCode === 401) {
          onAuthExpired();
          return;
        }

        setExceptionFormError(error.message);
        setExceptionFieldErrors(error.details ?? []);
      } finally {
        if (isCurrent) {
          setIsLoadingExceptions(false);
        }
      }
    }

    loadInitialExceptions();

    return () => {
      isCurrent = false;
    };
  }, [authToken, exceptionFilters, onAuthExpired]);

  function resetWeeklyForm() {
    setWeeklyFormData(initialWeeklyFormData);
    setEditingWeeklyId("");
    setWeeklyFieldErrors([]);
    setWeeklyFormError("");
  }

  function resetExceptionForm() {
    setExceptionFormData(getInitialExceptionFormData());
    setEditingExceptionId("");
    setExceptionFieldErrors([]);
    setExceptionFormError("");
  }

  function handleWeeklyFormChange(event) {
    const { name, value } = event.target;

    setWeeklyFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleExceptionFormChange(event) {
    const { name, value } = event.target;

    setExceptionFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleFullDayChange(event) {
    const { checked } = event.target;

    setExceptionFormData((currentFormData) => ({
      ...currentFormData,
      isFullDay: checked,
    }));
  }

  function handleWeeklyFilterChange(event) {
    const { name, value } = event.target;

    setWeeklyFilter((currentFilter) => ({
      ...currentFilter,
      [name]: value,
    }));
    setWeeklyStatusMessage("");
    setWeeklyFormError("");
    setWeeklyFieldErrors([]);
  }

  function handleExceptionFilterChange(event) {
    const { name, value } = event.target;

    setExceptionFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
    setExceptionStatusMessage("");
    setExceptionFormError("");
    setExceptionFieldErrors([]);
  }

  async function handleWeeklySubmit(event) {
    event.preventDefault();

    if (!authToken) {
      onAuthExpired();
      return;
    }

    setWeeklyFieldErrors([]);
    setWeeklyFormError("");
    setWeeklyStatusMessage("");
    setIsSavingWeekly(true);

    try {
      if (editingWeeklyId) {
        await updateWeeklyAvailability(
          authToken,
          editingWeeklyId,
          weeklyFormData,
        );
        setWeeklyStatusMessage("Weekly window updated.");
        resetWeeklyForm();
        await loadWeeklyAvailability(weeklyFilter, { silent: true });
        return;
      }

      await createWeeklyAvailability(authToken, weeklyFormData);
      setWeeklyStatusMessage("Weekly window created.");
      resetWeeklyForm();
      await loadWeeklyAvailability(weeklyFilter, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setWeeklyFormError(error.message);
      setWeeklyFieldErrors(error.details ?? []);
    } finally {
      setIsSavingWeekly(false);
    }
  }

  async function handleExceptionSubmit(event) {
    event.preventDefault();

    if (!authToken) {
      onAuthExpired();
      return;
    }

    setExceptionFieldErrors([]);
    setExceptionFormError("");
    setExceptionStatusMessage("");
    setIsSavingException(true);

    try {
      const payload = getAvailabilityExceptionPayload(exceptionFormData);

      if (editingExceptionId) {
        await updateAvailabilityException(
          authToken,
          editingExceptionId,
          payload,
        );
        setExceptionStatusMessage("One-time change updated.");
        resetExceptionForm();
        await loadAvailabilityExceptions(exceptionFilters, { silent: true });
        return;
      }

      await createAvailabilityException(authToken, payload);
      setExceptionStatusMessage("One-time change created.");
      resetExceptionForm();
      await loadAvailabilityExceptions(exceptionFilters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setExceptionFormError(error.message);
      setExceptionFieldErrors(error.details ?? []);
    } finally {
      setIsSavingException(false);
    }
  }

  function handleEditWeekly(availabilityWindow) {
    setEditingWeeklyId(availabilityWindow.id);
    setWeeklyFormData({
      weekday: String(availabilityWindow.weekday),
      startTime: availabilityWindow.startTime,
      endTime: availabilityWindow.endTime,
      label: availabilityWindow.label ?? "",
    });
    setWeeklyFieldErrors([]);
    setWeeklyFormError("");
    setWeeklyStatusMessage("");
  }

  function handleEditException(exception) {
    setEditingExceptionId(exception.id);
    setExceptionFormData({
      exceptionDate: exception.exceptionDate,
      type: exception.type,
      isFullDay: exception.isFullDay,
      startTime: exception.startTime ?? "14:00",
      endTime: exception.endTime ?? "16:00",
      reason: exception.reason ?? "",
    });
    setExceptionFieldErrors([]);
    setExceptionFormError("");
    setExceptionStatusMessage("");
  }

  async function handleDeleteWeekly(availabilityWindow) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    const confirmed = window.confirm(
      "Delete " +
        getWeekdayLabel(availabilityWindow.weekday) +
        " " +
        formatTimeRange(
          availabilityWindow.startTime,
          availabilityWindow.endTime,
        ) +
        "?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingWeeklyId(availabilityWindow.id);
    setWeeklyStatusMessage("");
    setWeeklyFormError("");
    setWeeklyFieldErrors([]);

    try {
      await deleteWeeklyAvailability(authToken, availabilityWindow.id);
      setWeeklyStatusMessage("Weekly window deleted.");

      if (editingWeeklyId === availabilityWindow.id) {
        resetWeeklyForm();
      }

      await loadWeeklyAvailability(weeklyFilter, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setWeeklyFormError(error.message);
      setWeeklyFieldErrors(error.details ?? []);
    } finally {
      setDeletingWeeklyId("");
    }
  }

  async function handleDeleteException(exception) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    const confirmed = window.confirm(
      "Delete change for " + formatExceptionDate(exception.exceptionDate) + "?",
    );

    if (!confirmed) {
      return;
    }

    setDeletingExceptionId(exception.id);
    setExceptionStatusMessage("");
    setExceptionFormError("");
    setExceptionFieldErrors([]);

    try {
      await deleteAvailabilityException(authToken, exception.id);
      setExceptionStatusMessage("One-time change deleted.");

      if (editingExceptionId === exception.id) {
        resetExceptionForm();
      }

      await loadAvailabilityExceptions(exceptionFilters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setExceptionFormError(error.message);
      setExceptionFieldErrors(error.details ?? []);
    } finally {
      setDeletingExceptionId("");
    }
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <WeeklyAvailabilityForm
          editingWeeklyId={editingWeeklyId}
          fieldErrors={weeklyFieldErrors}
          formData={weeklyFormData}
          formError={weeklyFormError}
          isSaving={isSavingWeekly}
          onCancelEdit={resetWeeklyForm}
          onChange={handleWeeklyFormChange}
          onSubmit={handleWeeklySubmit}
        />
        <ExceptionForm
          editingExceptionId={editingExceptionId}
          fieldErrors={exceptionFieldErrors}
          formData={exceptionFormData}
          formError={exceptionFormError}
          isSaving={isSavingException}
          onCancelEdit={resetExceptionForm}
          onChange={handleExceptionFormChange}
          onFullDayChange={handleFullDayChange}
          onSubmit={handleExceptionSubmit}
        />
      </div>

      <div className="grid content-start gap-4">
        <WeeklyList
          deletingWeeklyId={deletingWeeklyId}
          filter={weeklyFilter}
          isLoading={isLoadingWeekly}
          onDeleteWeekly={handleDeleteWeekly}
          onEditWeekly={handleEditWeekly}
          onFilterChange={handleWeeklyFilterChange}
          onRefresh={() => loadWeeklyAvailability(weeklyFilter)}
          statusMessage={weeklyStatusMessage}
          weeklyAvailability={weeklyAvailability}
        />
        <ExceptionList
          availabilityExceptions={availabilityExceptions}
          deletingExceptionId={deletingExceptionId}
          filters={exceptionFilters}
          isLoading={isLoadingExceptions}
          onDeleteException={handleDeleteException}
          onEditException={handleEditException}
          onFilterChange={handleExceptionFilterChange}
          onRefresh={() => loadAvailabilityExceptions(exceptionFilters)}
          statusMessage={exceptionStatusMessage}
        />
      </div>
    </div>
  );
}
