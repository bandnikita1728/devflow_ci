import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchStats, fetchReviews, type Stats, type ReviewJob } from "@/lib/api";
import { formatMs, timeAgo } from "@/lib/utils";

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentReviews, setRecentReviews] = useState<ReviewJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [statsData, reviewsData] = await Promise.all([
          fetchStats(),
          fetchReviews(1),
        ]);
        setStats(statsData);
        setRecentReviews(reviewsData.data.slice(0, 10));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <XCircle className="h-10 w-10 text-gh-error mb-3" />
        <p className="text-sm font-semibold text-gh-text-primary mb-1">Something went wrong</p>
        <p className="text-sm text-gh-text-secondary">{error}</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total PRs",
      value: stats?.totalPRs ?? 0,
      icon: GitPullRequest,
    },
    {
      title: "Completed",
      value: stats?.completedReviews ?? 0,
      icon: CheckCircle2,
    },
    {
      title: "Failed",
      value: stats?.failedReviews ?? 0,
      icon: XCircle,
    },
    {
      title: "Avg Time",
      value: stats ? formatMs(stats.avgProcessingTimeMs) : "—",
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-gh-border">
        <h1 className="text-2xl font-normal text-gh-text-primary">
          Dashboard
        </h1>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) =>
          loading ? (
            <div key={card.title} className="rounded-md border border-gh-border bg-gh-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ) : (
            <div
              key={card.title}
              className="rounded-md border border-gh-border bg-gh-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="h-4 w-4 text-gh-text-secondary" />
                <p className="text-sm font-semibold text-gh-text-secondary">
                  {card.title}
                </p>
              </div>
              <p className="text-2xl font-semibold text-gh-text-primary">
                {card.value}
              </p>
            </div>
          )
        )}
      </div>

      {/* Recent Activity */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-gh-text-primary">
            Recent activity
          </h2>
          <Link
            to="/reviews"
            className="text-sm font-semibold text-gh-link hover:underline"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="rounded-md border border-gh-border bg-gh-card">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gh-border last:border-0">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="ml-auto h-3.5 w-14" />
              </div>
            ))}
          </div>
        ) : recentReviews.length === 0 ? (
          <div className="rounded-md border border-gh-border bg-gh-card py-16 text-center">
            <GitPullRequest className="mx-auto h-8 w-8 text-gh-text-secondary mb-3" />
            <p className="text-[16px] font-semibold text-gh-text-primary">No reviews yet</p>
            <p className="mt-1 text-sm text-gh-text-secondary">
              Reviews will appear here once PRs are processed
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-gh-border bg-gh-card">
            <div className="bg-gh-sidebar px-4 py-3 border-b border-gh-border rounded-t-md">
              <span className="text-sm font-semibold text-gh-text-primary">Latest reviews</span>
            </div>
            {recentReviews.map((review) => {
              return (
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
