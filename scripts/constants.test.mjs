import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/constants.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const source = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { matchesBlocklist } = await import(moduleUrl);

test('a specific host exclusion overrides a monitored parent domain', () => {
  assert.equal(
    matchesBlocklist(
      'https://music.youtube.com/watch?v=abc',
      ['youtube.com'],
      ['music.youtube.com']
    ),
    false
  );
});

test('an exclusion does not disable other subdomains', () => {
  assert.equal(
    matchesBlocklist(
      'https://www.youtube.com/shorts/abc',
      ['youtube.com'],
      ['music.youtube.com']
    ),
    true
  );
});

test('path exclusions override broader domain monitoring', () => {
  assert.equal(
    matchesBlocklist(
      'https://news.example.com/private/inbox',
      ['example.com'],
      ['example.com/private']
    ),
    false
  );
  assert.equal(
    matchesBlocklist(
      'https://news.example.com/feed',
      ['example.com'],
      ['example.com/private']
    ),
    true
  );
});