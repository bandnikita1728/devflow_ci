import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { decryptToken } from './auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/stats — return { totalPRs, completedReviews, failedReviews, avgProcessingTimeMs }
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const totalPRs = await prisma.pullRequest.count();
    const completedReviews = await prisma.reviewJob.count({
      where: { status: 'completed' },
    });
    const failedReviews = await prisma.reviewJob.count({
      where: { status: 'failed' },
    });

    const completedJobs = await prisma.reviewJob.findMany({
      where: { status: 'completed', processingTimeMs: { not: null } },
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.reviewJob.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          pullRequest: true,
        },
      }),
      prisma.reviewJob.count(),
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
    const id = req.params.id as string;
    const review = await prisma.reviewJob.findUnique({
      where: { id },
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
    const { repoFullName } = req.body;
    
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
    
    // Create webhook
    const webhookUrl = process.env.WEBHOOK_URL || 'https://your-ngrok-url/webhooks/github';
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || process.env.GITHUB_SECRET;

    let hookId: string;
    try {
      const hook = await octokit.repos.createWebhook({
        owner,
        repo,
        name: 'web',
        active: true,
        events: ['pull_request'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
        }
      });
      hookId = hook.data.id.toString();
    } catch (err: any) {
      if (err.status === 422) {
        // Webhook already exists on this repo (e.g. from an earlier connection attempt) — reuse it instead of failing
        const { data: hooks } = await octokit.repos.listWebhooks({ owner, repo });
        const existingHook = hooks.find((h: any) => h.config?.url === webhookUrl) || hooks[0];
        if (!existingHook) {
          throw err;
        }
        hookId = existingHook.id.toString();
      } else {
        throw err;
      }
    }

    const newRepo = await prisma.repository.create({
      data: {
        userId,
        githubRepoId: ghRepo.data.id.toString(),
        fullName: repoFullName,
        webhookId: hookId,
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.encryptedToken) {
      res.status(401).json({ error: 'User token missing' });
      return;
    }

    const token = decryptToken(user.encryptedToken);
    const octokit = new Octokit({ auth: token });
    const [owner, repo] = repository.fullName.split('/');

    if (repository.webhookId) {
      try {
        await octokit.repos.deleteWebhook({
          owner,
          repo,
          hook_id: parseInt(repository.webhookId, 10)
        });
      } catch (err: any) {
        if (err.status !== 404) { // Ignore if webhook was already deleted manually
          throw err;
        }
      }
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
