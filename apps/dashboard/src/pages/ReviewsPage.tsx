import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GitPullRequest, XCircle } from "lucide-react";
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
        <XCircle className="h-10 w-10 text-gh-error mb-3" />
        <p className="text-sm font-semibold text-gh-text-primary mb-1">Something went wrong</p>
        <p className="text-sm text-gh-text-secondary">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="pb-4 border-b border-gh-border flex items-center justify-between">
        <h1 className="text-2xl font-normal text-gh-text-primary">
          Reviews
        </h1>
        {data && (
          <span className="text-sm text-gh-text-secondary border border-gh-border rounded-[2em] px-3 py-1">
            {data.meta.total} jobs
          </span>
        )}
      </div>

      <div className="rounded-md border border-gh-border bg-gh-card">
        <div className="bg-gh-sidebar px-4 py-3 border-b border-gh-border rounded-t-md">
          <span className="text-sm font-semibold text-gh-text-primary">
            {data ? `${data.meta.total} review jobs` : 'Loading...'}
          </span>
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gh-border last:border-0">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-3.5 w-14" />
              </div>
            ))}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="py-20 text-center">
            <GitPullRequest className="mx-auto h-8 w-8 text-gh-text-secondary mb-3" />
            <p className="text-[16px] font-semibold text-gh-text-primary">No reviews found</p>
            <p className="mt-1 text-sm text-gh-text-secondary">
              Reviews will appear here as pull requests are processed
            </p>
          </div>
        ) : (
          <div>
            {data.data.map((review) => (
              <div
                key={review.id}
                className="flex items-center justify-between border-b border-gh-border px-4 py-3 last:border-b-0 hover:bg-gh-sidebar transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={review.status} />
                  <Link
                    to={`/reviews/${review.id}`}
                    className="text-[16px] font-semibold text-gh-text-primary hover:text-gh-link"
                  >
                    {review.pullRequest.repoFullName}
                  </Link>
                  <span className="text-sm text-gh-link">
                    #{review.pullRequest.prNumber}
                  </span>
                </div>
                <span className="text-sm text-gh-text-secondary">
                  {timeAgo(review.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-gh-border bg-gh-card px-4 py-2 text-sm font-medium text-gh-link hover:bg-gh-sidebar disabled:text-gh-border transition-colors"
          >
            Previous
          </button>
          <button
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-gh-border bg-gh-card px-4 py-2 text-sm font-medium text-gh-link hover:bg-gh-sidebar disabled:text-gh-border transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
