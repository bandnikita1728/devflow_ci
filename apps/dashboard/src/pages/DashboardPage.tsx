import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
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
        <XCircle className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-900 mb-1">Something went wrong</p>
        <p className="text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total PRs",
      value: stats?.totalPRs ?? 0,
      icon: GitPullRequest,
      iconColor: "text-indigo-500",
      iconBg: "bg-indigo-50",
    },
    {
      title: "Completed",
      value: stats?.completedReviews ?? 0,
      icon: CheckCircle2,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
    },
    {
      title: "Failed",
      value: stats?.failedReviews ?? 0,
      icon: XCircle,
      iconColor: "text-red-500",
      iconBg: "bg-red-50",
    },
    {
      title: "Avg Time",
      value: stats ? formatMs(stats.avgProcessingTimeMs) : "—",
      icon: Clock,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your code review pipeline
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) =>
          loading ? (
            <div key={card.title} className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <Skeleton className="h-7 w-12" />
            </div>
          ) : (
            <div
              key={card.title}
              className="rounded-lg border border-slate-200 bg-white p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {card.title}
                </p>
                <div className={`rounded-md p-1.5 ${card.iconBg}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {card.value}
              </p>
            </div>
          )
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Recent activity
          </h2>
          <Link
            to="/reviews"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 last:border-0">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="ml-auto h-3.5 w-14" />
              </div>
            ))}
          </div>
        ) : recentReviews.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white py-16 text-center">
            <GitPullRequest className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-900">No reviews yet</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Reviews will appear here once PRs are processed
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {recentReviews.map((review) => {
              const statusColor =
                review.status === "completed" ? "border-l-green-500" :
                review.status === "failed" ? "border-l-red-500" :
                review.status === "processing" ? "border-l-blue-500" :
                "border-l-amber-500";

              return (
                <Link
                  key={review.id}
                  to={`/reviews/${review.id}`}
                  className={`flex items-center gap-4 border-b border-slate-100 border-l-2 ${statusColor} px-5 py-3.5 last:border-b-0 hover:bg-slate-50/60 transition-colors`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-900">
                      {review.pullRequest.repoFullName}
                    </span>
                    <span className="ml-2 text-sm text-slate-400">
                      #{review.pullRequest.prNumber}
                    </span>
                  </div>
                  <StatusBadge status={review.status} />
                  <span className="text-xs text-slate-400 w-16 text-right shrink-0">
                    {timeAgo(review.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
