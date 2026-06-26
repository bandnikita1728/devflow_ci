import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { decryptToken } from './auth';
import { App } from '@octokit/app';
import { readFileSync } from 'fs';

const router = Router();
const prisma = new PrismaClient();

const privateKey = process.env.GITHUB_APP_PRIVATE_KEY ||
  (() => {
    try {
      return readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH || './devflow-ci.2026-06-17.private-key.pem', 'utf8');
    } catch {
      return '';
    }
  })();

const app = new App({
  appId: process.env.GITHUB_APP_ID || '',
  privateKey,
  Octokit: Octokit as any,
});

// GET /api/stats — return { totalPRs, completedReviews, failedReviews, avgProcessingTimeMs }
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const totalPRs = await prisma.pullRequest.count({
      where: { userId },
    });
    const completedReviews = await prisma.reviewJob.count({
      where: { status: 'completed', pullRequest: { userId } },
    });
    const failedReviews = await prisma.reviewJob.count({
      where: { status: 'failed', pullRequest: { userId } },
    });

    const completedJobs = await prisma.reviewJob.findMany({
      where: { status: 'completed', processingTimeMs: { not: null }, pullRequest: { userId } },
      select: { processingTimeMs: true },
    });

    const totalProcessingTime = completedJobs.reduce(
      (sum, job) => sum + (job.processingTimeMs || 0),
      0
    );
    const avgProcessingTimeMs =
      completedJobs.length > 0
        ? Math.round(totalProcessingTime / completedJobs.length)
        : 0;

    res.json({
      totalPRs,
      completedReviews,
      failedReviews,
      avgProcessingTimeMs,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/reviews — paginated list (20 per page), include PullRequest relation, ordered by createdAt desc
router.get('/reviews', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.reviewJob.findMany({
        where: { pullRequest: { userId } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          pullRequest: true,
        },
      }),
      prisma.reviewJob.count({
        where: { pullRequest: { userId } },
      }),
    ]);

    res.json({
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/:id — single ReviewJob with all ReviewComments and PullRequest
router.get('/reviews/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const review = await prisma.reviewJob.findFirst({
      where: { id, pullRequest: { userId } },
      include: {
        pullRequest: true,
        comments: {
          orderBy: { createdAt: 'desc' }
        },
      },
    });

    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    res.json(review);
  } catch (error) {
    console.error('Error fetching review detail:', error);
    res.status(500).json({ error: 'Failed to fetch review detail' });
  }
});

// GET /api/repos — list user's connected repos
router.get('/repos', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const repos = await prisma.repository.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(repos);
  } catch (error) {
    console.error('Error fetching repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// POST /api/repos — connect a repo
router.post('/repos', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { repoFullName: rawName } = req.body;
    const repoFullName = rawName?.trim();
    
    if (!repoFullName || !repoFullName.includes('/')) {
      res.status(400).json({ error: 'Invalid repository name format' });
      return;
    }

    const [owner, repo] = repoFullName.split('/');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.encryptedToken) {
      res.status(401).json({ error: 'User token missing' });
      return;
    }

    const token = decryptToken(user.encryptedToken);
    const octokit = new Octokit({ auth: token });

    // Check if repository already exists in DB
    const existingRepo = await prisma.repository.findUnique({
      where: { fullName: repoFullName }
    });
    
    if (existingRepo) {
      res.status(400).json({ error: 'Repository already connected' });
      return;
    }

    // Verify repo access and get repo ID
    const ghRepo = await octokit.repos.get({ owner, repo });
    
    // Retrieve installation ID dynamically using the GitHub App
    let installationId: number;
    try {
      const { data: installation } = await app.octokit.request(
        'GET /repos/{owner}/{repo}/installation',
        { owner, repo }
      );
      installationId = installation.id;
    } catch (err: any) {
      console.error('Error fetching installation for repository:', err);
      res.status(404).json({ error: 'GitHub App is not installed on this repository. Please install it first.' });
      return;
    }

    const newRepo = await prisma.repository.create({
      data: {
        userId,
        githubRepoId: ghRepo.data.id.toString(),
        fullName: repoFullName,
        webhookId: null,
        installationId,
        isActive: true,
      }
    });

    res.json(newRepo);
  } catch (error: any) {
    console.error('Error connecting repo:', error);
    if (error.status === 404) {
      res.status(404).json({ error: 'Repository not found or insufficient permissions' });
    } else {
      res.status(500).json({ error: 'Failed to connect repository' });
    }
  }
});

// DELETE /api/repos/:id — disconnect repo
router.delete('/repos/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const repoId = req.params.id as string;

    const repository = await prisma.repository.findFirst({
      where: { id: repoId, userId }
    });

    if (!repository) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    await prisma.repository.delete({
      where: { id: repoId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting repo:', error);
    res.status(500).json({ error: 'Failed to disconnect repository' });
  }
});

export default router;
