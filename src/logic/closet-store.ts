import type { StorageLike } from './bag-store';

export const CLOSET_STORAGE_KEY = 'runway-virtual-closet-v1';
export const MAX_CLOSET_OUTFITS = 24;

export const CLOSET_CATEGORIES = [
  'Streetwear',
  'Athletic',
  'Studio',
  'Outerwear',
  'Evening',
] as const;

export type ClosetCategory = (typeof CLOSET_CATEGORIES)[number];

export const ARCHIVE_LOOK_CATEGORIES: Record<string, ClosetCategory> = {
  bndthK: 'Streetwear',
  XckgG6: 'Evening',
  rLfAhC: 'Outerwear',
  FKg67q: 'Studio',
  '8KREEE': 'Outerwear',
  N3bfm9: 'Athletic',
};

export interface ClosetOutfit {
  id: string;
  name: string;
  category: ClosetCategory;
  note: string;
  pieces: string[];
  imageDataUrl: string;
  worn: boolean;
  createdAt: number;
}

export function normalizeClosetCategory(value?: string): ClosetCategory {
  if (value && (CLOSET_CATEGORIES as readonly string[]).includes(value)) {
    return value as ClosetCategory;
  }
  return 'Streetwear';
}

function getSafeStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function loadClosetOutfits(storage?: StorageLike | null): ClosetOutfit[] {
  const store = getSafeStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(CLOSET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: ClosetOutfit[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.imageDataUrl === 'string' &&
        item.imageDataUrl.startsWith('data:image/')
      ) {
        result.push({
          id: item.id,
          name: item.name.trim() || 'Custom Look',
          category: normalizeClosetCategory(
            typeof item.category === 'string' ? item.category : undefined
          ),
          note: typeof item.note === 'string' ? item.note : '',
          pieces: Array.isArray(item.pieces)
            ? item.pieces.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
            : [],
          imageDataUrl: item.imageDataUrl,
          worn: Boolean(item.worn),
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        });
        if (result.length >= MAX_CLOSET_OUTFITS) break;
      }
    }
    return result;
  } catch {
    return [];
  }
}

export function saveClosetOutfits(outfits: ClosetOutfit[], storage?: StorageLike | null): boolean {
  const store = getSafeStorage(storage);
  if (!store) return false;
  try {
    store.setItem(CLOSET_STORAGE_KEY, JSON.stringify(outfits.slice(0, MAX_CLOSET_OUTFITS)));
    return true;
  } catch {
    return false;
  }
}

export function createClosetOutfit(input: {
  id?: string;
  name: string;
  category?: string;
  note?: string;
  pieces?: string[];
  imageDataUrl: string;
  worn?: boolean;
  createdAt?: number;
}): ClosetOutfit {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Please give this outfit a look name.');
  }
  if (!input.imageDataUrl || !input.imageDataUrl.startsWith('data:image/')) {
    throw new Error('Please choose a valid outfit image.');
  }
  const cleanPieces = (input.pieces ?? [])
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    id: input.id || `closet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    category: normalizeClosetCategory(input.category),
    note: (input.note ?? '').trim() || 'Uploaded to Virtual Closet',
    pieces: cleanPieces.length > 0 ? cleanPieces : ['Custom Runway Piece'],
    imageDataUrl: input.imageDataUrl,
    worn: Boolean(input.worn),
    createdAt: input.createdAt ?? Date.now(),
  };
}

export function addClosetOutfit(
  current: ClosetOutfit[],
  outfit: ClosetOutfit
): ClosetOutfit[] {
  return [outfit, ...current].slice(0, MAX_CLOSET_OUTFITS);
}

export function setOutfitWorn(
  current: ClosetOutfit[],
  id: string,
  worn: boolean
): ClosetOutfit[] {
  return current.map((o) => (o.id === id ? { ...o, worn } : o));
}

export function removeClosetOutfit(current: ClosetOutfit[], id: string): ClosetOutfit[] {
  return current.filter((o) => o.id !== id);
}

export function getWornOutfits(current: ClosetOutfit[]): ClosetOutfit[] {
  return current.filter((o) => o.worn);
}

export function filterByCategory<T extends { category: ClosetCategory }>(
  items: T[],
  category: 'all' | ClosetCategory
): T[] {
  if (category === 'all') return items;
  return items.filter((item) => item.category === category);
}
