import axios from "axios";
import { API_BASE_URL } from "../config";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

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
  category?: string | null;
  title?: string | null;
  explanation?: string | null;
  owaspRef?: string | null;
  owaspUrl?: string | null;
  fixDescription?: string | null;
  fixCode?: string | null;
  fixLanguage?: string | null;
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
