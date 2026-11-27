import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeToiletModerator } from './toiletModerator.js';

const clerk = vi.hoisted(() => ({ verify: vi.fn(), getUser: vi.fn() }));
vi.mock('@clerk/backend', () => ({
  verifyToken: clerk.verify,
  createClerkClient: () => ({ users: { getUser: clerk.getUser } }),
}));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
const req = { headers: { authorization: 'Bearer test-token' } };

describe('toilet moderator authorization', () => {
  it('rejects missing credentials and unavailable configuration', async () => {
    expect(await authorizeToiletModerator({ headers: {} })).toEqual({ status: 401 });
    vi.stubEnv('CLERK_SECRET_KEY', '');
    expect(await authorizeToiletModerator(req)).toEqual({ status: 503 });
  });
  it('rejects invalid signatures and ignores a role in token claims', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'test-secret');
    clerk.verify.mockRejectedValueOnce(new Error('invalid signature'));
    expect(await authorizeToiletModerator(req)).toEqual({ status: 401 });
    clerk.verify.mockResolvedValue({ sub: 'citizen', role: 'admin' });
    clerk.getUser.mockResolvedValue({ publicMetadata: { role: 'citizen' } });
    expect(await authorizeToiletModerator(req)).toEqual({ status: 403 });
    expect(clerk.getUser).toHaveBeenCalledWith('citizen');
  });
  it('permits server-confirmed admins and fails closed on metadata outages', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'test-secret');
    clerk.verify.mockResolvedValue({ sub: 'moderator' });
    clerk.getUser.mockResolvedValueOnce({ publicMetadata: { role: 'admin' } });
    expect(await authorizeToiletModerator(req)).toEqual({ userId: 'moderator' });
    clerk.getUser.mockRejectedValueOnce(new Error('unavailable'));
    expect(await authorizeToiletModerator(req)).toEqual({ status: 503 });
  });
});
