import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  AlertCircle,
  FileCode2,
  Clock,
  GitPullRequest
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
        setError(err instanceof Error ? err.message : "Failed to load review details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle className="h-10 w-10 text-gh-error mb-3" />
        <p className="text-sm font-semibold text-gh-text-primary mb-1">Something went wrong</p>
        <p className="text-sm text-gh-text-secondary">{error}</p>
        <Link
          to="/reviews"
          className="mt-6 text-sm font-medium text-gh-link hover:underline"
        >
          &larr; Back to reviews
        </Link>
      </div>
    );
  }

  if (loading || !review) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-md" />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  const { pullRequest } = review;
  const comments = review.comments || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-gh-border">
        <div className="flex items-center gap-2 text-sm text-gh-text-secondary mb-2">
          <Link to="/reviews" className="hover:text-gh-link hover:underline flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Reviews
          </Link>
          <span>/</span>
          <span>{pullRequest.repoFullName}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal text-gh-text-primary">
              {pullRequest.repoFullName} <span className="text-gh-text-secondary font-light">#{pullRequest.prNumber}</span>
            </h1>
            <StatusBadge status={review.status} className="text-[13px] px-2.5 py-0.5" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Main Content: Comments */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 border-b border-gh-border pb-2">
            <MessageSquare className="h-4 w-4 text-gh-text-secondary" />
            <h2 className="text-[16px] font-semibold text-gh-text-primary">
              Review Comments ({comments.length})
            </h2>
          </div>

          {comments.length === 0 ? (
            <div className="rounded-md border border-gh-border bg-gh-sidebar py-12 text-center text-gh-text-secondary text-sm">
              No comments generated for this review.
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-md border border-gh-border bg-gh-card overflow-hidden">
                  <div className="bg-gh-sidebar px-4 py-2 border-b border-gh-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gh-text-primary text-sm">DevFlow AI</span>
                      <span className="text-gh-text-secondary text-[13px]">
                        commented {timeAgo(comment.createdAt)}
                      </span>
                    </div>
                    <SeverityBadge severity={comment.severity} />
                  </div>
                  <div className="p-4 text-sm text-gh-text-primary">
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-gh-link bg-[#ddf4ff] border border-[#0969da40] rounded px-1.5 py-0.5">
                        <FileCode2 className="h-3 w-3" />
                        {comment.filePath}:{comment.lineNumber}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{comment.commentBody}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Details */}
        <div className="space-y-4">
          <div className="rounded-md border border-gh-border bg-gh-card">
            <div className="border-b border-gh-border px-4 py-3 bg-gh-sidebar rounded-t-md">
              <h3 className="text-sm font-semibold text-gh-text-primary">Details</h3>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <span className="block text-gh-text-secondary mb-1">Repository</span>
                <a
                  href={`https://github.com/${pullRequest.repoFullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gh-link hover:underline flex items-center gap-1.5"
                >
                  <GitPullRequest className="h-4 w-4 text-gh-text-secondary" />
                  {pullRequest.repoFullName}
                </a>
              </div>
              <div className="pt-4 border-t border-gh-border">
                <span className="block text-gh-text-secondary mb-1">Processing time</span>
                <span className="font-medium text-gh-text-primary flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gh-text-secondary" />
                  {formatMs(review.processingTimeMs || 0)}
                </span>
              </div>
              {review.errorMessage && (
                <div className="pt-4 border-t border-gh-border">
                  <span className="block text-gh-text-secondary mb-1">Error message</span>
                  <p className="text-gh-error text-[13px]">{review.errorMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
