export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#F0F7FF]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Sidebar Skeleton */}
          <aside className="w-full lg:w-[30%] space-y-6">
            <div className="bg-white rounded-lg p-6 space-y-4 border border-[#E8F4FD]">
              <div className="h-8 w-3/4 bg-[#E8F4FD] rounded animate-pulse"></div>
              <div className="h-6 w-1/2 bg-[#E8F4FD] rounded animate-pulse"></div>
              <div className="h-4 w-full bg-[#E8F4FD] rounded animate-pulse"></div>
            </div>
            <div className="bg-white rounded-lg p-6 space-y-4 border border-[#E8F4FD]">
              <div className="h-6 w-2/3 bg-[#E8F4FD] rounded animate-pulse"></div>
              <div className="h-12 w-full bg-[#E8F4FD] rounded animate-pulse"></div>
              <div className="h-6 w-1/2 bg-[#E8F4FD] rounded animate-pulse"></div>
            </div>
          </aside>

          {/* Right Main Area Skeleton */}
          <main className="w-full lg:w-[70%] space-y-8">
            <div className="bg-white rounded-lg p-6 border border-[#E8F4FD]">
              <div className="h-96 w-full bg-[#E8F4FD] rounded animate-pulse"></div>
              <div className="h-6 w-3/4 bg-[#E8F4FD] rounded animate-pulse mt-4"></div>
            </div>
            <div className="space-y-4">
              <div className="h-8 w-1/4 bg-[#E8F4FD] rounded animate-pulse"></div>
              <div className="flex gap-4 overflow-x-auto">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-64 h-48 bg-[#E8F4FD] rounded animate-pulse"
                  ></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
