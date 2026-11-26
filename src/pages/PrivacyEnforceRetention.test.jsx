import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  enforce: vi.fn(),
  buttons: [],
}));

// A static render cannot click, so every <button> element created while rendering is recorded
// and the onClick of the "Enforce Retention" one is called directly afterwards.
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    jsxDEV: (type, props, ...rest) => {
      if (type === 'button' && props?.onClick) mocks.buttons.push(props);
      return actual.jsxDEV(type, props, ...rest);
    },
  };
});
vi.mock('react/jsx-runtime', async (importOriginal) => {
  const actual = await importOriginal();
  const wrap = (fn) => (type, props, ...rest) => {
    if (type === 'button' && props?.onClick) mocks.buttons.push(props);
    return fn(type, props, ...rest);
  };
  return { ...actual, jsx: wrap(actual.jsx), jsxs: wrap(actual.jsxs) };
});

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('../context/ConfirmationDialogContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../services/privacyConsentService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, enforceRetentionPolicies: (...args) => mocks.enforce(...args) };
});

import Privacy from './Privacy';

const text = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return text(node.props?.children);
};

const clickEnforceRetention = () => {
  mocks.buttons.length = 0;
  renderToStaticMarkup(
    <MemoryRouter>
      <Privacy />
    </MemoryRouter>
  );
  const button = mocks.buttons.find((props) => text(props.children).includes('Enforce Retention'));
  expect(button).toBeTruthy();
  button.onClick();
};

describe('Privacy page Enforce Retention', () => {
  beforeEach(() => {
    Object.values(mocks.toast).forEach((fn) => fn.mockReset());
    mocks.enforce.mockReset();
  });

  it('shows a success toast when stores were cleaned', () => {
    mocks.enforce.mockReturnValue({ actionTaken: true, purgedKeysCount: 2, prunedRecordsCount: 3 });
    clickEnforceRetention();
    expect(mocks.toast.success).toHaveBeenCalledTimes(1);
    expect(mocks.toast.success.mock.calls[0][0]).toContain('cleaned 2 store(s)');
  });

  it('shows an info toast when everything is within the limits', () => {
    mocks.enforce.mockReturnValue({ actionTaken: false, purgedKeysCount: 0, prunedRecordsCount: 0 });
    clickEnforceRetention();
    expect(mocks.toast.info).toHaveBeenCalledWith('All local stores are currently within retention limits.');
  });

  it('shows an error toast when the check fails', () => {
    mocks.enforce.mockImplementation(() => {
      throw new Error('boom');
    });
    clickEnforceRetention();
    expect(mocks.toast.error).toHaveBeenCalledWith('Retention check failed: boom');
  });
});
