import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const plazaSource = await readFile(new URL('../public/js/pages/courses/plaza.js', import.meta.url), 'utf8');

test('course plaza never renders a publish button', () => {
  assert.doesNotMatch(plazaSource, /id="plaza-publish-btn"/);
  assert.doesNotMatch(plazaSource, /onclick="handlePlazaPublish\(\)"/);
});
