import { describe, it, expect } from 'vitest';
import {
  sanitizeRedirectPath,
  locationToPath,
  getRedirectTarget,
  buildAuthPath,
  describeProtectedPath,
  APPROVED_REDIRECT_ORIGINS,
} from './authRedirect';

const ORIGIN = 'https://civicbridge.example';

describe('sanitizeRedirectPath', () => {
  it('keeps normal in-app paths, including query and hash', () => {
    expect(sanitizeRedirectPath('/saved')).toBe('/saved');
    expect(sanitizeRedirectPath('/saved?folder=work#top')).toBe('/saved?folder=work#top');
  });

  it('rejects other sites and protocol-relative urls', () => {
    expect(sanitizeRedirectPath('https://evil.com/saved', ORIGIN)).toBeNull();
    expect(sanitizeRedirectPath('//evil.com')).toBeNull();
    expect(sanitizeRedirectPath('/\\evil.com')).toBeNull();
    expect(sanitizeRedirectPath('javascript:alert(1)')).toBeNull();
    expect(sanitizeRedirectPath('saved')).toBeNull();
  });

  it('turns a full url on our own origin into a path', () => {
    expect(sanitizeRedirectPath(`${ORIGIN}/vault?x=1`, ORIGIN)).toBe('/vault?x=1');
  });

  it('rejects the auth pages so we never loop back to login', () => {
    expect(sanitizeRedirectPath('/login')).toBeNull();
    expect(sanitizeRedirectPath('/login/factor-one')).toBeNull();
    expect(sanitizeRedirectPath('/signup?redirect_url=%2Fsaved')).toBeNull();
    expect(sanitizeRedirectPath('/sso-callback')).toBeNull();
  });

  it('does not treat lookalike paths as auth pages', () => {
    expect(sanitizeRedirectPath('/login-help')).toBe('/login-help');
  });

  it('handles empty and non-string input', () => {
    expect(sanitizeRedirectPath('')).toBeNull();
    expect(sanitizeRedirectPath(null)).toBeNull();
    expect(sanitizeRedirectPath(undefined)).toBeNull();
    expect(sanitizeRedirectPath({ pathname: '/saved' })).toBeNull();
  });
});

describe('locationToPath', () => {
  it('joins pathname, search and hash', () => {
    expect(locationToPath({ pathname: '/saved', search: '?folder=a', hash: '#n' })).toBe('/saved?folder=a#n');
    expect(locationToPath({ pathname: '/vault' })).toBe('/vault');
    expect(locationToPath(null)).toBeNull();
  });
});

describe('getRedirectTarget', () => {
  it('uses the location object ProtectedRoute puts in router state', () => {
    const location = {
      search: '',
      state: { from: { pathname: '/saved', search: '?folder=work', hash: '' } },
    };
    expect(getRedirectTarget(location)).toBe('/saved?folder=work');
  });

  it('accepts a plain string in router state (login <-> signup links)', () => {
    expect(getRedirectTarget({ search: '', state: { from: '/vault' } })).toBe('/vault');
  });

  it('falls back to the redirect_url query param when state is gone', () => {
    expect(getRedirectTarget({ search: '?redirect_url=%2Fprofile', state: null })).toBe('/profile');
  });

  it('prefers router state over the query param', () => {
    const location = { search: '?redirect_url=%2Fprofile', state: { from: { pathname: '/vault' } } };
    expect(getRedirectTarget(location)).toBe('/vault');
  });

  it('ignores unsafe values in either place', () => {
    expect(getRedirectTarget({ search: '?redirect_url=%2F%2Fevil.com', state: null })).toBeNull();
    const location = { search: '?redirect_url=%2Fsaved', state: { from: { pathname: '/login' } } };
    expect(getRedirectTarget(location)).toBe('/saved');
  });

  it('returns null when there is no destination', () => {
    expect(getRedirectTarget({ search: '', state: null })).toBeNull();
    expect(getRedirectTarget(undefined)).toBeNull();
  });
});

describe('buildAuthPath', () => {
  it('adds the destination as redirect_url', () => {
    expect(buildAuthPath('/signup', '/saved')).toBe('/signup?redirect_url=%2Fsaved');
    expect(buildAuthPath('/login', '/saved?folder=a b')).toBe('/login?redirect_url=%2Fsaved%3Ffolder%3Da+b');
  });

  it('round trips through getRedirectTarget', () => {
    const target = '/saved?folder=work&sort=new#item-3';
    const link = buildAuthPath('/login', target);
    const search = link.slice(link.indexOf('?'));
    expect(getRedirectTarget({ search, state: null })).toBe(target);
  });

  it('leaves the link plain when there is no safe destination', () => {
    expect(buildAuthPath('/signup', null)).toBe('/signup');
    expect(buildAuthPath('/signup', '//evil.com')).toBe('/signup');
    expect(buildAuthPath('/signup', '/login')).toBe('/signup');
  });
});

describe('describeProtectedPath', () => {
  it('names the known protected pages', () => {
    expect(describeProtectedPath('/saved')).toBe('your saved services');
    expect(describeProtectedPath('/saved/?folder=a')).toBe('your saved services');
    expect(describeProtectedPath('/vault')).toBe('your document vault');
    expect(describeProtectedPath('/profile')).toBe('your profile');
    expect(describeProtectedPath('/admin')).toBe('the admin dashboard');
  });

  it('uses a generic name for other pages', () => {
    expect(describeProtectedPath('/track')).toBe('that page');
    expect(describeProtectedPath('/savedish')).toBe('that page');
  });

  it('returns null when there is nothing to explain', () => {
    expect(describeProtectedPath(null)).toBeNull();
    expect(describeProtectedPath('/')).toBeNull();
    expect(describeProtectedPath('/login')).toBeNull();
  });
});

describe('sanitizeRedirectPath hardening', () => {
  const rejected = [
    ['a tab hidden inside //', '/\t/evil.example'],
    ['a newline hidden inside //', '/\n/evil.example'],
    ['a carriage return hidden inside //', '/\r/evil.example'],
    ['a tab-separated backslash', '/\t\\evil.example'],
    ['a null byte', '/saved\u0000'],
    ['a unicode line separator', '/saved /x'],
    ['an encoded slash after the first slash', '/%2Fevil.example'],
    ['an encoded backslash after the first slash', '/%5Cevil.example'],
    ['an encoded tab after the first slash', '/%09/evil.example'],
    ['a double-encoded // path', '/%252F%252Fevil.example'],
    ['a fully encoded //', '%2F%2Fevil.example'],
    ['a javascript: url', 'javascript:alert(1)'],
    ['a mixed-case javascript: url', 'JaVaScRiPt:alert(1)'],
    ['a javascript: url with a tab', 'java\tscript:alert(1)'],
    ['an encoded javascript: url', '%6Aavascript:alert(1)'],
    ['a data: url', 'data:text/html,<script>alert(1)</script>'],
    ['a vbscript: url', 'vbscript:msgbox(1)'],
    ['a scheme hidden behind a slash', '/javascript:alert(1)'],
    ['an encoded scheme behind a slash', '/%6Aavascript:alert(1)'],
    ['a url with credentials that look like our host', 'https://app.example@evil.example/'],
    ['an http url on another origin', 'http://evil.example/saved'],
    ['an uppercase scheme on another origin', 'HTTPS://evil.example/saved'],
    ['a different port on our host', 'https://app.example:8443/saved'],
    ['a lookalike subdomain', 'https://app.example.evil.example/saved'],
    ['a malformed url', 'https://'],
    ['a malformed percent sequence', '/%E0%A4%A'],
    ['a triple slash', '///evil.example'],
    ['a slash, backslash, slash', '/\\/evil.example'],
    ['an absurdly long value', `/${'a'.repeat(3000)}`],
    ['whitespace only', '   '],
  ];

  it.each(rejected)('rejects %s', (_name, value) => {
    expect(sanitizeRedirectPath(value, 'https://app.example')).toBeNull();
  });

  it('rejects encoded versions of the auth pages', () => {
    expect(sanitizeRedirectPath('/%6Cogin')).toBeNull();
    expect(sanitizeRedirectPath('/sso-callback%3Fx=1')).toBeNull();
  });

  it('still allows ordinary paths that need encoding', () => {
    expect(sanitizeRedirectPath('/services/1?q=%E0%A4%AE%E0%A4%A6%E0%A4%A6')).toBe('/services/1?q=%E0%A4%AE%E0%A4%A6%E0%A4%A6');
    expect(sanitizeRedirectPath('/track?ref=a%20b#top')).toBe('/track?ref=a%20b#top');
    expect(sanitizeRedirectPath('/saved?next=https://evil.example')).toBe('/saved?next=https://evil.example');
  });

  it('accepts only origins on the approved list, and keeps them as full urls', () => {
    const approved = ['https://apply.example.org'];
    expect(sanitizeRedirectPath('https://apply.example.org/start?x=1', 'https://app.example', approved)).toBe(
      'https://apply.example.org/start?x=1'
    );
    expect(sanitizeRedirectPath('https://apply.example.org.evil.example/', 'https://app.example', approved)).toBeNull();
    expect(sanitizeRedirectPath('http://apply.example.org/', 'https://app.example', approved)).toBeNull();
    expect(sanitizeRedirectPath('https://other.example.org/', 'https://app.example', approved)).toBeNull();
  });

  it('trusts no external origin by default', () => {
    expect(APPROVED_REDIRECT_ORIGINS).toEqual([]);
  });
});
