import { NATIVE_CATALOG, type CatalogItem, type CatalogVariant, formatMoney, validateCatalog } from '../data/catalog';

export const BAG_STORAGE_KEY = 'runway-styling-bag-v4';
export const MAX_BAG_ENTRIES = 50;
export const MAX_ITEM_QTY = 20;

export interface BagEntry {
  id: number;
  quantity: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ResolvedBagItem {
  entry: BagEntry;
  item: CatalogItem;
  variant: CatalogVariant;
  sizeLabel: string;
  lineTotal: number;
}

function getSafeStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function loadBagEntries(storage?: StorageLike | null): BagEntry[] {
  const store = getSafeStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(BAG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: BagEntry[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        Number.isSafeInteger(item.id) &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= MAX_ITEM_QTY
      ) {
        valid.push({ id: item.id, quantity: item.quantity });
        if (valid.length >= MAX_BAG_ENTRIES) break;
      }
    }
    return valid;
  } catch {
    return [];
  }
}

export function saveBagEntries(entries: BagEntry[], storage?: StorageLike | null): void {
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(BAG_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_BAG_ENTRIES)));
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function findVariantInCatalog(
  variantId: number,
  catalog = NATIVE_CATALOG
): { item: CatalogItem; variant: CatalogVariant } | null {
  validateCatalog(catalog);
  for (const item of catalog.items) {
    const variant = item.variants.find((v) => v.id === variantId);
    if (variant) {
      return { item, variant };
    }
  }
  return null;
}

export function addItemsToBag(
  current: BagEntry[],
  requests: Array<{ id: number; quantity?: number }>,
  catalog = NATIVE_CATALOG
): { entries: BagEntry[]; addedCount: number; message: string } {
  validateCatalog(catalog);
  const next = current.map((e) => ({ ...e }));

  for (const req of requests) {
    const found = findVariantInCatalog(req.id, catalog);
    if (!found || !found.variant.a) {
      throw new Error('Please choose an available size.');
    }
  }

  let addedCount = 0;
  for (const req of requests) {
    const qty = Math.max(1, Math.min(MAX_ITEM_QTY, req.quantity ?? 1));
    const existing = next.find((e) => e.id === req.id);
    if (existing) {
      existing.quantity = Math.min(MAX_ITEM_QTY, existing.quantity + qty);
      addedCount += 1;
    } else if (next.length < MAX_BAG_ENTRIES) {
      next.push({ id: req.id, quantity: qty });
      addedCount += 1;
    }
  }

  const message =
    requests.length > 1 ? 'Look saved to your styling bag' : 'Piece saved to your styling bag';

  return { entries: next, addedCount, message };
}

export function removeBagEntry(current: BagEntry[], variantId: number): BagEntry[] {
  return current.filter((entry) => entry.id !== variantId);
}

export function getBagCount(entries: BagEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

export function resolveBagItems(
  entries: BagEntry[],
  catalog = NATIVE_CATALOG
): ResolvedBagItem[] {
  validateCatalog(catalog);
  const resolved: ResolvedBagItem[] = [];
  for (const entry of entries) {
    const found = findVariantInCatalog(entry.id, catalog);
    if (!found) continue;
    const sizeLabel = found.variant.o[0] ?? '';
    resolved.push({
      entry,
      item: found.item,
      variant: found.variant,
      sizeLabel,
      lineTotal: found.item.price * entry.quantity,
    });
  }
  return resolved;
}

export function getBagSubtotal(entries: BagEntry[], catalog = NATIVE_CATALOG): number {
  return resolveBagItems(entries, catalog).reduce((sum, row) => sum + row.lineTotal, 0);
}

export function verifyShopHostname(urlString: string): string {
  if (urlString.startsWith('#')) {
    return urlString;
  }
  const url = new URL(urlString);
  if (url.hostname !== 'lamer.atelier' && url.hostname !== 'nike-makknzjs.myshopify.com') {
    throw new Error(`Invalid product host: ${url.hostname}`);
  }
  return url.toString();
}

export function buildShortlistText(entries: BagEntry[], catalog = NATIVE_CATALOG): string {
  const rows = resolveBagItems(entries, catalog);
  const parts: string[] = [
    'LA MER — STYLING SHORTLIST',
    'Reference prices in Kenyan Shillings (KSh); no order or payment has been placed.',
    '',
  ];
  for (const row of rows) {
    parts.push(
      `${row.item.name} · Size ${row.sizeLabel} · Quantity ${row.entry.quantity} · ${formatMoney(row.item.price)}`
    );
    parts.push(row.item.url.startsWith('#') ? `La Mer Runway · ${row.item.id}` : row.item.url);
    parts.push('');
  }
  parts.push(`Reference subtotal: ${formatMoney(getBagSubtotal(entries, catalog))}`);
  return parts.join('\n\n');
}
