import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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

export default router;
