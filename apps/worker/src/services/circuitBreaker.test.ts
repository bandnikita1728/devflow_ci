let mockGenAIInstance: any;
let mockAppInstance: any;
let mockPrismaInstance: any;
let mockRedisInstance: any;

jest.mock('@google/genai', () => {
  const generateContent = jest.fn();
  const instance = {
    models: {
      generateContent,
    },
  };
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      mockGenAIInstance = instance;
      return instance;
    }),
  };
});

jest.mock('@octokit/app', () => {
  const request = jest.fn().mockResolvedValue({ data: { id: 123 } });
  const createComment = jest.fn().mockResolvedValue({});
  const getInstallationOctokit = jest.fn().mockResolvedValue({
    issues: {
      createComment,
    },
  });
  const instance = {
    octokit: {
      request,
    },
    getInstallationOctokit,
  };
  return {
    App: jest.fn().mockImplementation(() => {
      mockAppInstance = instance;
      return instance;
    }),
  };
});

jest.mock('@prisma/client', () => {
  const upsert = jest.fn().mockResolvedValue({ id: 'pr-123' });
  const create = jest.fn().mockResolvedValue({ id: 'job-123' });
  const instance = {
    pullRequest: {
      upsert,
    },
    reviewJob: {
      create,
    },
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      mockPrismaInstance = instance;
      return instance;
    }),
  };
});

jest.mock('ioredis', () => {
  const publish = jest.fn().mockResolvedValue(1);
  const set = jest.fn().mockResolvedValue('OK');
  const instance = {
    publish,
    set,
    on: jest.fn(),
  };
  const mockRedis = jest.fn().mockImplementation(() => {
    mockRedisInstance = instance;
    return instance;
  });
  return mockRedis;
});

import { callGeminiWithBreaker, breaker } from './circuitBreaker';

describe('Gemini AI Circuit Breaker Suite', () => {
  const context = {
    owner: 'test-owner',
    repo: 'test-repo',
    pullRequestNumber: 101,
    headSha: 'sha-abcdef123',
    repositoryFullName: 'test-owner/test-repo',
    bullmqJobId: 'bullmq-job-001',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    breaker.close(); // Ensure circuit starts closed
  });

  afterAll(() => {
    breaker.shutdown();
  });

  it('should resolve with the response when the Gemini API is successful and circuit is closed', async () => {
    const mockOutput = { text: '[{"file": "main.ts", "line": 10, "severity": "warning", "category": "bug", "comment": "fix"}]' };
    mockGenAIInstance.models.generateContent.mockResolvedValue(mockOutput);

    const result = await callGeminiWithBreaker('analyze this diff', context);

    expect(result).toEqual(mockOutput);
    expect(mockGenAIInstance.models.generateContent).toHaveBeenCalledTimes(1);
    expect(breaker.closed).toBe(true);
    expect(mockPrismaInstance.pullRequest.upsert).not.toHaveBeenCalled();
    expect(mockPrismaInstance.reviewJob.create).not.toHaveBeenCalled();
  });

  it('should run fallback when Gemini API fails and persist status as CIRCUIT_OPEN', async () => {
    const errorMsg = 'Gemini API is down or overloaded';
    mockGenAIInstance.models.generateContent.mockRejectedValue(new Error(errorMsg));

    const mockCreateComment = jest.fn().mockResolvedValue({});
    mockAppInstance.getInstallationOctokit.mockResolvedValue({
      issues: {
        createComment: mockCreateComment,
      },
    });

    const result = await callGeminiWithBreaker('analyze this diff', context);

    // Should return fallback result
    expect(result).toEqual({ fallback: true });

    // GitHub App should have posted comment
    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 101,
      body: 'DevFlow CI: AI review temporarily unavailable. Please retry or review manually.',
    });

    // PostgreSQL should have updated status to CIRCUIT_OPEN
    expect(mockPrismaInstance.pullRequest.upsert).toHaveBeenCalledWith({
      where: {
        repoFullName_prNumber: {
          repoFullName: 'test-owner/test-repo',
          prNumber: 101,
        },
      },
      update: {
        headSha: 'sha-abcdef123',
        status: 'CIRCUIT_OPEN',
      },
      create: {
        repoFullName: 'test-owner/test-repo',
        prNumber: 101,
        headSha: 'sha-abcdef123',
        status: 'CIRCUIT_OPEN',
      },
    });

    expect(mockPrismaInstance.reviewJob.create).toHaveBeenCalledWith({
      data: {
        pullRequestId: 'pr-123',
        bullmqJobId: 'bullmq-job-001',
        status: 'CIRCUIT_OPEN',
        completedAt: expect.any(Date),
        errorMessage: 'Gemini API is down or overloaded',
      },
    });

    // Redis events should publish circuit_open
    expect(mockRedisInstance.publish).toHaveBeenCalledWith(
      'circuit:gemini:events',
      expect.stringContaining('circuit_open')
    );
  });

  it('should trip the circuit to open after consecutive failures exceed the volume and error threshold', async () => {
    mockGenAIInstance.models.generateContent.mockRejectedValue(new Error('Rate limit error'));

    // Trigger 5 calls to exceed the volumeThreshold of 5 and trip the circuit
    for (let i = 0; i < 5; i++) {
      await callGeminiWithBreaker('test diff', context);
    }

    expect(breaker.opened).toBe(true);

    // The 6th call should fail fast without invoking Gemini generateContent at all
    mockGenAIInstance.models.generateContent.mockClear();
    const result = await callGeminiWithBreaker('test diff', context);

    expect(result).toEqual({ fallback: true });
    expect(mockGenAIInstance.models.generateContent).not.toHaveBeenCalled();
  });
});
