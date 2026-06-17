import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GitPullRequest, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchReviews, type ReviewJob, type PaginatedResponse } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

export function ReviewsPage() {
  const [data, setData] = useState<PaginatedResponse<ReviewJob> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchReviews(page);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load reviews");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <XCircle className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-900 mb-1">Something went wrong</p>
        <p className="text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Reviews
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            All code review jobs across your repositories
          </p>
        </div>
        {data && (
          <span className="text-xs text-slate-400">
            {data.meta.total} total
          </span>
        )}
      </div>

      {/* Reviews List */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-[1fr_140px_100px_100px] gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-2.5">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Repository</span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Created</span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Action</span>
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_100px_100px] gap-4 items-center px-5 py-3.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="ml-auto h-3.5 w-8" />
              </div>
            ))}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-20 text-center">
            <GitPullRequest className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-900">No reviews found</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Reviews will appear here as pull requests are processed
            </p>
          </div>
        ) : (
          <div>
            {data.data.map((review) => {
              const statusColor =
                review.status === "completed" ? "border-l-green-500" :
                review.status === "failed" ? "border-l-red-500" :
                review.status === "processing" ? "border-l-blue-500" :
                "border-l-amber-500";

              return (
                <div
                  key={review.id}
                  className={`grid grid-cols-[1fr_140px_100px_100px] gap-4 items-center border-b border-slate-100 border-l-2 ${statusColor} px-5 py-3.5 last:border-b-0 hover:bg-slate-50/60 transition-colors`}
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">
                      {review.pullRequest.repoFullName}
                    </span>
                    <span className="ml-2 text-sm text-slate-400">
                      #{review.pullRequest.prNumber}
                    </span>
                  </div>
                  <div>
                    <StatusBadge status={review.status} />
                  </div>
                  <span className="text-xs text-slate-500">
                    {timeAgo(review.createdAt)}
                  </span>
                  <div className="text-right">
                    <Link
                      to={`/reviews/${review.id}`}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {data.meta.page} of {data.meta.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              Previous
            </button>
            <button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
