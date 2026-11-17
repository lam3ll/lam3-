import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addClosetOutfit,
  createClosetOutfit,
  filterByCategory,
  getWornOutfits,
  loadClosetOutfits,
  normalizeClosetCategory,
  removeClosetOutfit,
  saveClosetOutfits,
  setOutfitWorn,
} from './closet-store';
import type { StorageLike } from './bag-store';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

const SAMPLE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test('closet store creates, persists, toggles wear state, and removes outfits', () => {
  const storage = createMemoryStorage();
  const outfit = createClosetOutfit({
    id: 'fit-1',
    name: 'Midnight Cargo',
    category: 'Outerwear',
    note: 'Layered fleece & wide denim',
    pieces: ['Heavy Fleece', 'Cargo Pant', 'Air Max'],
    imageDataUrl: SAMPLE_DATA_URL,
    worn: true,
    createdAt: 1000,
  });

  let list = addClosetOutfit([], outfit);
  assert.equal(list.length, 1);
  assert.equal(getWornOutfits(list).length, 1);

  saveClosetOutfits(list, storage);
  const loaded = loadClosetOutfits(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Midnight Cargo');
  assert.equal(loaded[0].category, 'Outerwear');
  assert.equal(loaded[0].worn, true);

  list = setOutfitWorn(loaded, 'fit-1', false);
  assert.equal(getWornOutfits(list).length, 0);

  list = removeClosetOutfit(list, 'fit-1');
  assert.equal(list.length, 0);
});

test('category normalization and filtering handle valid and fallback categories', () => {
  assert.equal(normalizeClosetCategory('Studio'), 'Studio');
  assert.equal(normalizeClosetCategory('Unknown'), 'Streetwear');

  const a = createClosetOutfit({ id: 'a', name: 'Track Fit', category: 'Athletic', imageDataUrl: SAMPLE_DATA_URL });
  const b = createClosetOutfit({ id: 'b', name: 'Studio Fit', category: 'Studio', imageDataUrl: SAMPLE_DATA_URL });
  const all = [a, b];

  assert.equal(filterByCategory(all, 'all').length, 2);
  assert.deepEqual(
    filterByCategory(all, 'Athletic').map((o) => o.id),
    ['a']
  );
  assert.equal(filterByCategory(all, 'Evening').length, 0);
});

test('createClosetOutfit validates required name and image data url', () => {
  assert.throws(
    () => createClosetOutfit({ name: '   ', imageDataUrl: SAMPLE_DATA_URL }),
    /look name/i
  );
  assert.throws(
    () => createClosetOutfit({ name: 'Test', imageDataUrl: 'https://example.com/a.jpg' }),
    /valid outfit image/i
  );
});
