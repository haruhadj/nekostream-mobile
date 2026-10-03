import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDefaultSubtitle } from '../src/lib/player-subtitles.ts';

const track = (language, label, isDefault = false) => ({ language, label, id: label, isDefault });

test('English dialogue wins over foreign default and English signs', () => {
  const japanese = track('ja', 'Japanese', true);
  const signs = track('en', 'Signs & Songs', true);
  const dialogue = track('eng', 'Full dialogue');
  assert.equal(selectDefaultSubtitle([japanese, signs, dialogue]), dialogue);
});

test('recognizes regional codes and English names on untagged tracks', () => {
  for (const english of [track('en-US', 'Dialogue'), track('und', 'English')]) {
    assert.equal(selectDefaultSubtitle([track('ja', 'Japanese', true), english]), english);
  }
});

test('prefers the default among full English tracks', () => {
  const preferred = track('en', 'English dialogue', true);
  assert.equal(selectDefaultSubtitle([track('en', 'English alternate'), preferred]), preferred);
});

test('handles late discovery and falls back when English is absent', () => {
  assert.equal(selectDefaultSubtitle([]), null);
  const french = track('fr', 'French', true);
  assert.equal(selectDefaultSubtitle([track('ja', 'Japanese'), french]), french);
  const english = track('en', 'English');
  assert.equal(selectDefaultSubtitle([french, english]), english);
  const first = track('ja', 'Japanese');
  assert.equal(selectDefaultSubtitle([first]), first);
});
