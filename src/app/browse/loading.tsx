export default function BrowseLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="h-11 max-w-2xl animate-pulse rounded-[8px] bg-line/60" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-[8px] bg-line/50" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-[12px] bg-line/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
