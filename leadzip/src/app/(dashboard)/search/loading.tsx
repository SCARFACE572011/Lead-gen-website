export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-sand" />
        <div className="h-4 w-64 animate-pulse rounded bg-paper-2" />
      </div>

      <div className="flex gap-6">
        {/* Sidebar skeleton */}
        <aside className="hidden w-72 shrink-0 space-y-4 lg:block">
          <div className="rounded-2xl border border-sand bg-card p-4 space-y-4">
            <div className="h-4 w-24 animate-pulse rounded bg-sand" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-16 animate-pulse rounded bg-paper-2" />
                <div className="h-9 w-full animate-pulse rounded-lg bg-paper-2" />
              </div>
            ))}
            <div className="h-10 w-full animate-pulse rounded-full bg-signal-50" />
          </div>
        </aside>

        {/* Results skeleton */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Toolbar skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 animate-pulse rounded bg-sand" />
            <div className="flex gap-2">
              <div className="h-8 w-32 animate-pulse rounded-lg bg-sand" />
              <div className="h-8 w-16 animate-pulse rounded-lg bg-sand" />
            </div>
          </div>

          {/* Card skeletons */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-2xl border border-sand bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-sand" />
                    <div className="h-3 w-1/3 animate-pulse rounded-full bg-paper-2" />
                  </div>
                  <div className="h-6 w-16 animate-pulse rounded-full bg-paper-2" />
                </div>
                <div className="h-3 w-1/2 animate-pulse rounded bg-paper-2" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-paper-2" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-paper-2" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-signal-50" />
                <div className="mt-1 flex gap-2 border-t border-sand pt-3">
                  <div className="h-7 w-16 animate-pulse rounded-lg bg-paper-2" />
                  <div className="h-7 w-16 animate-pulse rounded-lg bg-paper-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
