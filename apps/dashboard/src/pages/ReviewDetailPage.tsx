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
              {comments.map((comment) => {
                const owaspUrl = comment.owaspUrl;
                const isValidOwaspUrl = owaspUrl && owaspUrl.startsWith('https://owasp.org/');

                return (
                  <div key={comment.id} className="rounded-md border border-gh-border bg-gh-card overflow-hidden">
                    <div className="bg-gh-sidebar px-4 py-2 border-b border-gh-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gh-text-primary text-sm">
                          {comment.title || 'DevFlow AI Review'}
                        </span>
                        <span className="text-gh-text-secondary text-[13px]">
                          commented {timeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {comment.category && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-[#0969da20] bg-[#ddf4ff] text-gh-link capitalize">
                            {comment.category}
                          </span>
                        )}
                        <SeverityBadge severity={comment.severity} />
                      </div>
                    </div>
                    <div className="p-4 text-sm text-gh-text-primary space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-gh-link bg-[#ddf4ff] border border-[#0969da40] rounded px-1.5 py-0.5">
                          <FileCode2 className="h-3 w-3" />
                          {comment.filePath}:{comment.lineNumber}
                        </span>
                      </div>

                      {/* Explanation */}
                      <div>
                        <h4 className="text-[11px] font-semibold text-gh-text-secondary uppercase tracking-wider mb-1">
                          Why this is dangerous:
                        </h4>
                        <p className="whitespace-pre-wrap leading-relaxed text-gh-text-primary">
                          {comment.explanation || comment.commentBody}
                        </p>
                      </div>

                      {/* OWASP Link */}
                      {comment.owaspRef && (
                        <div className="text-[13px]">
                          <span className="font-semibold text-gh-text-secondary">OWASP Reference: </span>
                          {isValidOwaspUrl ? (
                            <a
                              href={owaspUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gh-link hover:underline font-medium"
                            >
                              OWASP {comment.owaspRef}
                            </a>
                          ) : (
                            <span className="font-medium text-gh-text-primary">OWASP {comment.owaspRef}</span>
                          )}
                        </div>
                      )}

                      {/* Fix Description */}
                      {comment.fixDescription && (
                        <div>
                          <h4 className="text-[11px] font-semibold text-gh-text-secondary uppercase tracking-wider mb-1">
                            Suggested Fix:
                          </h4>
                          <p className="whitespace-pre-wrap leading-relaxed text-gh-text-primary">
                            {comment.fixDescription}
                          </p>
                        </div>
                      )}

                      {/* Code Block */}
                      {comment.fixCode && (
                        <div className="rounded border border-gh-border bg-gh-sidebar p-3 font-mono text-[12px] whitespace-pre overflow-x-auto text-gh-text-primary mt-2">
                          <div className="text-gh-text-secondary border-b border-gh-border pb-1 mb-1 select-none">
                            // AI-generated fix — review before applying.
                          </div>
                          {comment.fixCode}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
