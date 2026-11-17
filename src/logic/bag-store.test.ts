import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addItemsToBag,
  buildShortlistText,
  getBagCount,
  getBagSubtotal,
  loadBagEntries,
  removeBagEntry,
  saveBagEntries,
  verifyShopHostname,
  type StorageLike,
} from './bag-store';
import {
  CATALOG_ITEMS,
  NATIVE_CATALOG,
  formatMoney,
  validateCatalog,
} from '../data/catalog';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

test('validateCatalog accepts NATIVE_CATALOG and enforces max item price of KSh 4,500', () => {
  assert.equal(validateCatalog(NATIVE_CATALOG).items.length, 8);
  const maxPrice = Math.max(...CATALOG_ITEMS.map((item) => item.price));
  assert.equal(maxPrice, 4500);
  assert.equal(formatMoney(4500), 'KSh 4,500');
  assert.throws(
    () =>
      validateCatalog({
        source: 'x',
        looks: [],
        items: [{ id: '', name: 'Bad', price: -5 } as never],
      }),
    /unavailable/i
  );
});

test('addItemsToBag adds items, increments existing quantities, and calculates KSh subtotal', () => {
  const storage = createMemoryStorage();
  const res1 = addItemsToBag([], [{ id: 57015167090993, quantity: 1 }]);
  assert.equal(res1.message, 'Piece saved to your styling bag');
  assert.equal(getBagCount(res1.entries), 1);

  const res2 = addItemsToBag(res1.entries, [
    { id: 57015167090993, quantity: 1 },
    { id: 56835911582001, quantity: 1 },
  ]);
  assert.equal(res2.message, 'Look saved to your styling bag');
  assert.equal(getBagCount(res2.entries), 3);
  assert.equal(getBagSubtotal(res2.entries), 3400 * 2 + 4500);

  saveBagEntries(res2.entries, storage);
  const reloaded = loadBagEntries(storage);
  assert.equal(reloaded.length, 2);
  assert.equal(getBagCount(reloaded), 3);

  const afterRemove = removeBagEntry(reloaded, 57015167090993);
  assert.equal(afterRemove.length, 1);
  assert.equal(getBagSubtotal(afterRemove), 4500);
});

test('addItemsToBag rejects unknown variants', () => {
  assert.throws(() => addItemsToBag([], [{ id: 999999999 }]), /available size/i);
});

test('verifyShopHostname enforces trusted product hosts', () => {
  assert.ok(verifyShopHostname('https://nike-makknzjs.myshopify.com/products/tshirt'));
  assert.throws(() => verifyShopHostname('https://evil.example.com/products/tshirt'));
});

test('buildShortlistText formats entries cleanly in KSh', () => {
  const text = buildShortlistText([{ id: 57015167090993, quantity: 1 }]);
  assert.match(text, /STYLING SHORTLIST/);
  assert.match(text, /Air Jordan 12 Retro · Size 42 · Quantity 1/);
  assert.match(text, /KSh 3,400/);
});
