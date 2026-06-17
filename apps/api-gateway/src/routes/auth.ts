import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Helper to generate JWT
const generateToken = (user: { id: string, githubId: string, username: string }) => {
  return jwt.sign(
    { id: user.id, githubId: user.githubId, username: user.username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

const generateRefreshToken = (user: { id: string }) => {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// GET /auth/github
router.get('/github', (_req: Request, res: Response) => {
  const redirectUri = 'http://localhost:3001/auth/github/callback';
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&scope=user,repo`;
  res.redirect(githubAuthUrl);
});

// GET /auth/github/callback
router.get('/github/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).json({ error: 'No code provided' });
    return;
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenResponse.json() as { access_token?: string };
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      res.status(400).json({ error: 'Failed to retrieve access token' });
      return;
    }

    // 2. Fetch user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    const userData = await userResponse.json() as { id?: number, login?: string, email?: string, avatar_url?: string };

    if (!userData || !userData.id) {
      res.status(400).json({ error: 'Failed to retrieve user profile' });
      return;
    }

    const githubId = userData.id.toString();
    const username = userData.login ?? 'unknown';
    const email = userData.email;
    const avatarUrl = userData.avatar_url;

    // 3. Upsert User in DB
    const user = await prisma.user.upsert({
      where: { githubId },
      update: {
        username,
        email,
        avatarUrl,
        encryptedToken: accessToken,
      },
      create: {
        githubId,
        username,
        email,
        avatarUrl,
        encryptedToken: accessToken,
      },
    });

    // 4. Issue JWT and Refresh Token
    const jwtToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Use lax to allow cross-site redirect from GitHub without losing cookie
      maxAge: 3600000, // 1h
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600000, // 7d
    });

    // 5. Redirect to frontend
    res.redirect('http://localhost:5173');
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.status(500).json({ error: 'OAuth flow failed' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { id: string, type: string };
    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const jwtToken = generateToken(user);
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600000, // 1h
    });

    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

// GET /api/auth/me (also works without /api prefix depending on where it's mounted)
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, githubId: true, username: true, email: true, avatarUrl: true },
    });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
