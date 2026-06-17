import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PullRequest {
  id: string;
  repoFullName: string;
  prNumber: number;
  headSha: string;
  status: string;
  createdAt: string;
}

export interface ReviewJob {
  id: string;
  pullRequestId: string;
  bullmqJobId: string | null;
  status: string;
  tokensUsed: number | null;
  processingTimeMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  pullRequest: PullRequest;
  comments?: ReviewComment[];
}

export interface ReviewComment {
  id: string;
  reviewJobId: string;
  filePath: string;
  lineNumber: number | null;
  commentType: string;
  severity: string;
  commentBody: string;
  githubCommentId: string | null;
  createdAt: string;
}

export interface Stats {
  totalPRs: number;
  completedReviews: number;
  failedReviews: number;
  avgProcessingTimeMs: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>("/stats");
  return data;
}

export async function fetchReviews(
  page: number = 1
): Promise<PaginatedResponse<ReviewJob>> {
  const { data } = await api.get<PaginatedResponse<ReviewJob>>("/reviews", {
    params: { page },
  });
  return data;
}

export async function fetchReviewDetail(id: string): Promise<ReviewJob> {
  const { data } = await api.get<ReviewJob>(`/reviews/${id}`);
  return data;
}
