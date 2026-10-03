import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRedirectParams, resolveOAuthNavigation } from '../src/auth/url.ts';

test('warm AniList callbacks do not navigate while sign-in completes', () => {
  const callback = 'nekostream://auth/anilist#access_token=test-token&expires_in=3600';
  assert.equal(resolveOAuthNavigation(callback, false), '');
  assert.equal(parseRedirectParams(callback).access_token, 'test-token');
});

test('MAL success and provider errors also stay with the browser session', () => {
  for (const callback of [
    'nekostream://auth/mal?code=test-code&state=test-state',
    'nekostream://auth/anilist#error=access_denied',
    '/auth/anilist#access_token=test-token',
  ]) assert.equal(resolveOAuthNavigation(callback, false), '');
});

test('cold callbacks enter the auth gate without credentials in the route', () => {
  assert.equal(resolveOAuthNavigation('nekostream://auth/anilist#access_token=test-token', true), '/');
  assert.equal(resolveOAuthNavigation('nekostream://auth/mal?code=test-code', true), '/');
});

test('anime links, other routes, and lookalike callback URLs remain untouched', () => {
  for (const path of [
    'https://anilist.co/anime/1', 'nekostream://anime/1',
    'nekostream://auth/anilist-other', 'https://example.com/auth/anilist',
    'nekostream://auth/mal/extra',
  ]) assert.equal(resolveOAuthNavigation(path, false), null);
});
