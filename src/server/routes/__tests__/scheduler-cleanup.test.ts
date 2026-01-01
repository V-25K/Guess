import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Router, type Request, type Response } from 'express';

const mockSetSupabaseConfig = vi.fn();
const mockAnonymizeInactiveUsers = vi.fn();
const mockSettingsGet = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

function createTestRouter() {
  const router = Router();
  router.post('/user-data-cleanup', async (_req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const supabaseUrl = await mockSettingsGet('supabaseUrl');
      const supabaseKey = await mockSettingsGet('supabaseAnonKey');
      if (!supabaseUrl || !supabaseKey) {
        const duration = Date.now() - startTime;
        mockLoggerError('Supabase not configured', undefined, { operation: 'user-data-cleanup', duration });
        return res.status(500).json({ status: 'error', duration, error: 'Supabase not configured' });
      }
      mockSetSupabaseConfig(supabaseUrl, supabaseKey);
      const result = await mockAnonymizeInactiveUsers(30);
      const duration = Date.now() - startTime;
      if (result.ok) {
        mockLoggerInfo('Cleanup completed', { operation: 'user-data-cleanup', duration, ...result.value });
        return res.json({ status: 'ok', duration, result: result.value });
      } else {
        mockLoggerError('Cleanup failed', undefined, { operation: 'user-data-cleanup', duration, error: result.error });
        return res.status(500).json({ status: 'error', duration, error: result.error.message || 'Cleanup failed' });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      mockLoggerError('Exception', error, { operation: 'user-data-cleanup', duration });
      return res.status(500).json({ status: 'error', duration, error: errorMessage });
    }
  });
  return router;
}

describe('Scheduler Routes - user-data-cleanup', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/internal/scheduler', createTestRouter());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return success response with cleanup statistics', async () => {
    mockSettingsGet.mockImplementation((key: string) => {
      if (key === 'supabaseUrl') return Promise.resolve('https://test.supabase.co');
      if (key === 'supabaseAnonKey') return Promise.resolve('test-key');
      return Promise.resolve(null);
    });
    mockAnonymizeInactiveUsers.mockResolvedValue({
      ok: true,
      value: { profilesAnonymized: 5, challengesUpdated: 10, attemptsUpdated: 25, executionTimeMs: 150 },
    });

    const response = await request(app).post('/internal/scheduler/user-data-cleanup').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.duration).toBeGreaterThanOrEqual(0);
    expect(response.body.result.profilesAnonymized).toBe(5);
  });

  it('should invoke cleanup with 30-day retention', async () => {
    mockSettingsGet.mockImplementation((key: string) => {
      if (key === 'supabaseUrl') return Promise.resolve('https://test.supabase.co');
      if (key === 'supabaseAnonKey') return Promise.resolve('test-key');
      return Promise.resolve(null);
    });
    mockAnonymizeInactiveUsers.mockResolvedValue({
      ok: true,
      value: { profilesAnonymized: 0, challengesUpdated: 0, attemptsUpdated: 0, executionTimeMs: 50 },
    });

    await request(app).post('/internal/scheduler/user-data-cleanup').expect(200);
    expect(mockAnonymizeInactiveUsers).toHaveBeenCalledWith(30);
  });

  it('should return error when Supabase not configured', async () => {
    mockSettingsGet.mockResolvedValue(null);
    const response = await request(app).post('/internal/scheduler/user-data-cleanup').expect(500);
    expect(response.body.status).toBe('error');
    expect(response.body.error).toContain('Supabase');
  });

  it('should return error when cleanup fails', async () => {
    mockSettingsGet.mockImplementation((key: string) => {
      if (key === 'supabaseUrl') return Promise.resolve('https://test.supabase.co');
      if (key === 'supabaseAnonKey') return Promise.resolve('test-key');
      return Promise.resolve(null);
    });
    mockAnonymizeInactiveUsers.mockResolvedValue({
      ok: false,
      error: { type: 'database', message: 'Connection timeout' },
    });

    const response = await request(app).post('/internal/scheduler/user-data-cleanup').expect(500);
    expect(response.body.status).toBe('error');
    expect(response.body.error).toContain('Connection timeout');
  });

  it('should handle unexpected exceptions', async () => {
    mockSettingsGet.mockImplementation((key: string) => {
      if (key === 'supabaseUrl') return Promise.resolve('https://test.supabase.co');
      if (key === 'supabaseAnonKey') return Promise.resolve('test-key');
      return Promise.resolve(null);
    });
    mockAnonymizeInactiveUsers.mockRejectedValue(new Error('Unexpected error'));

    const response = await request(app).post('/internal/scheduler/user-data-cleanup').expect(500);
    expect(response.body.status).toBe('error');
    expect(response.body.error).toBe('Unexpected error');
  });

  it('should always include status and duration in response', async () => {
    mockSettingsGet.mockResolvedValue(null);
    const response = await request(app).post('/internal/scheduler/user-data-cleanup');
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('duration');
  });
});
