const navItems = [
  "Dashboard",
  "Courses",
  "Coursework",
  "Availability",
  "Study Plan",
  "Recommendations",
  "Progress",
  "Profile",
];

function App() {
  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row lg:px-8">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:w-64">
          <h1 className="text-xl font-semibold">StudyGuard</h1>
          <nav className="mt-6 grid gap-1" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
                key={item}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
                Dashboard
              </p>
              <h2 className="mt-1 text-3xl font-semibold">Today</h2>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Workload status: Waiting for coursework
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">Today's Tasks</h3>
              <p className="mt-3 text-sm text-slate-600">No coursework yet.</p>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">Study Blocks</h3>
              <p className="mt-3 text-sm text-slate-600">
                No study blocks yet.
              </p>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">Upcoming Deadlines</h3>
              <p className="mt-3 text-sm text-slate-600">
                No deadlines have been added.
              </p>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold">Weekly Workload</h3>
              <p className="mt-3 text-sm text-slate-600">
                Required and available hours will appear here.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
