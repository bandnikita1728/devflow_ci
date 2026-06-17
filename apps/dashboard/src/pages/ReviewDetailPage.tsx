import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  FileCode2,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { SeverityBadge } from "@/components/SeverityBadge";
import { fetchReviewDetail, type ReviewJob } from "@/lib/api";
import { formatMs, timeAgo } from "@/lib/utils";

export function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<ReviewJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await fetchReviewDetail(id);
        setReview(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load review details"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-24" />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <div className="mt-6 grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
              <Skeleton className="h-3.5 w-48 mb-3" />
              <Skeleton className="h-16 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <XCircle className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-900 mb-1">
          {error ? "Something went wrong" : "Review not found"}
        </p>
        <p className="text-xs text-slate-500 mb-5">
          {error ?? "The review you're looking for doesn't exist."}
        </p>
        <Link
          to="/reviews"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Reviews
        </Link>
      </div>
    );
  }

  const comments = review.comments ?? [];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/reviews"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Reviews
      </Link>

      {/* PR Info Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {review.pullRequest.repoFullName}
              <span className="ml-1.5 text-slate-400 font-normal">
                #{review.pullRequest.prNumber}
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {timeAgo(review.createdAt)}
            </p>
          </div>
          <StatusBadge status={review.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 pt-5 border-t border-slate-100">
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Head SHA
            </p>
            <p className="font-mono text-sm text-slate-700">
              {review.pullRequest.headSha.substring(0, 7)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Processing Time
            </p>
            <p className="text-sm text-slate-700">
              {review.processingTimeMs ? formatMs(review.processingTimeMs) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Tokens Used
            </p>
            <p className="text-sm text-slate-700">
              {review.tokensUsed?.toLocaleString() ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Comments
            </p>
            <p className="text-sm text-slate-700">
              {comments.length}
            </p>
          </div>
        </div>

        {review.errorMessage && (
          <div className="mt-5 rounded-md bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-xs font-medium text-red-700 mb-0.5">Error</p>
            <p className="text-sm text-red-600 font-mono leading-relaxed">
              {review.errorMessage}
            </p>
          </div>
        )}
      </div>

      {/* Review Comments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-slate-900">
            Comments
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {comments.length}
          </span>
        </div>

        {comments.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white py-14 text-center">
            <p className="text-sm font-medium text-slate-900">No comments</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {review.status === "completed"
                ? "The AI found no issues to report"
                : "Comments will appear once the review completes"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {comments.map((comment) => {
              const borderColor =
                comment.severity === "critical" || comment.severity === "error"
                  ? "border-l-red-400"
                  : comment.severity === "warning"
                    ? "border-l-amber-400"
                    : comment.severity === "info"
                      ? "border-l-blue-400"
                      : "border-l-slate-300";

              return (
                <div
                  key={comment.id}
                  className={`rounded-lg border border-slate-200 border-l-2 ${borderColor} bg-white p-4`}
                >
                  {/* File + severity header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono text-xs text-slate-700 truncate">
                        {comment.filePath}
                      </span>
                      {comment.lineNumber && (
                        <span className="text-xs text-slate-400 shrink-0">
                          L{comment.lineNumber}
                        </span>
                      )}
                    </div>
                    <SeverityBadge severity={comment.severity} />
                  </div>

                  {/* Comment body */}
                  <div className="rounded-md bg-slate-50 px-3.5 py-3">
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {comment.commentBody}
                    </p>
                  </div>

                  {/* Type label */}
                  <p className="mt-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    {comment.commentType}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
