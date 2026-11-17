export interface CatalogVariant {
  id: number;
  a: boolean;
  o: string[];
}

export interface CatalogItem {
  id: string;
  name: string;
  vendor: string;
  type: string;
  price: number;
  image: string;
  width: number;
  height: number;
  sheetHeight: number;
  optionName: string;
  sizes: string[];
  variants: CatalogVariant[];
  url: string;
}

export interface LookPin {
  number: number;
  productId: string;
  productName: string;
  left: string;
  top: string;
}

export interface LookPieceRef {
  productId: string;
  tag?: string;
}

export interface RunwayLook {
  index: number;
  key: string;
  name: string;
  description: string;
  image640: string;
  image1080: string;
  piecesLabel: string;
  pieces: LookPieceRef[];
  pins: LookPin[];
}

export interface NativeCatalog {
  source: string;
  looks: Array<{
    name: string;
    description: string;
    image: string;
    products: string[];
  }>;
  items: CatalogItem[];
}

const ASSET_BASE = 'https://reel-ref-try-the-look.vercel.app/assets';

export const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'tatum-5-orbit-copy',
    name: 'Air Jordan 12 Retro',
    vendor: 'Nikey | Password: 1',
    type: 'From the original lookbook',
    price: 3400,
    image: `${ASSET_BASE}/source-tatum-5-orbit-copy.webp`,
    width: 400,
    height: 400,
    sheetHeight: 160,
    optionName: 'Shoe size',
    sizes: ['40', '41', '42', '43', '44', '45', '46'],
    variants: [
      { id: 57015167025457, a: true, o: ['40'] },
      { id: 57015167058225, a: true, o: ['41'] },
      { id: 57015167090993, a: true, o: ['42'] },
      { id: 57015167123761, a: true, o: ['43'] },
      { id: 57015167156529, a: true, o: ['44'] },
      { id: 57015167189297, a: true, o: ['45'] },
      { id: 57015167222065, a: true, o: ['46'] },
    ],
    url: 'https://nike-makknzjs.myshopify.com/products/tatum-5-orbit-copy',
  },
  {
    id: 'tshirt',
    name: 'Tshirt',
    vendor: 'Nike',
    type: 'From the original lookbook',
    price: 4500,
    image: `${ASSET_BASE}/source-tshirt.webp`,
    width: 400,
    height: 563,
    sheetHeight: 225,
    optionName: 'Size',
    sizes: ['S', 'L', 'M', 'XL'],
    variants: [
      { id: 56835911582001, a: true, o: ['S'] },
      { id: 56835911614769, a: true, o: ['L'] },
      { id: 56835911647537, a: true, o: ['M'] },
      { id: 56835911680305, a: true, o: ['XL'] },
    ],
    url: 'https://nike-makknzjs.myshopify.com/products/tshirt',
  },
  {
    id: 'sweatshirt',
    name: 'Sweatshirt',
    vendor: 'Nike',
    type: 'From the original lookbook',
    price: 4500,
    image: `${ASSET_BASE}/source-sweatshirt.webp`,
    width: 400,
    height: 581,
    sheetHeight: 232,
    optionName: 'Size',
    sizes: ['S', 'L', 'M', 'XL'],
    variants: [
      { id: 56835806396721, a: true, o: ['S'] },
      { id: 56835806429489, a: true, o: ['L'] },
      { id: 56835806462257, a: true, o: ['M'] },
      { id: 56835806495025, a: true, o: ['XL'] },
    ],
    url: 'https://nike-makknzjs.myshopify.com/products/sweatshirt',
  },
  {
    id: 'tatum-5-orbit',
    name: 'Tatum 5 Orbit',
    vendor: 'Nikey | Password: 1',
    type: 'From the original lookbook',
    price: 3400,
    image: `${ASSET_BASE}/source-tatum-5-orbit.webp`,
    width: 400,
    height: 400,
    sheetHeight: 160,
    optionName: 'Shoe size',
    sizes: ['40', '41', '42', '43', '44', '45', '46'],
    variants: [
      { id: 57015166730545, a: true, o: ['40'] },
      { id: 57015166763313, a: true, o: ['41'] },
      { id: 57015166796081, a: true, o: ['42'] },
      { id: 57015166828849, a: true, o: ['43'] },
      { id: 57015166861617, a: true, o: ['44'] },
      { id: 57015166894385, a: true, o: ['45'] },
      { id: 57015166927153, a: true, o: ['46'] },
    ],
    url: 'https://nike-makknzjs.myshopify.com/products/tatum-5-orbit',
  },
  {
    id: 'hoodie-black',
    name: 'Hoodie Black',
    vendor: 'Nike',
    type: 'From the original lookbook',
    price: 4500,
    image: `${ASSET_BASE}/source-hoodie-black.webp`,
    width: 400,
    height: 536,
    sheetHeight: 214,
    optionName: 'Size',
    sizes: ['S', 'L', 'M', 'XL'],
    variants: [
      { id: 56836251681073, a: true, o: ['S'] },
      { id: 56836251713841, a: true, o: ['L'] },
      { id: 56836251746609, a: true, o: ['M'] },
      { id: 56836251779377, a: true, o: ['XL'] },
    ],
    url: 'https://nike-makknzjs.myshopify.com/products/hoodie-black',
  },
  {
    id: 'sweatshirt-plus',
    name: 'Sweatshirt Plus',
    vendor: 'Nike',
    type: 'From the original lookbook',
    price: 4500,
    image: `${ASSET_BASE}/source-sweatshirt-plus.webp`,
    width: 400,
    height: 610,
    sheetHeight: 244,
    optionName: 'Size',
    sizes: ['S', 'L', 'M', 'XL'],
    variants: [
      { id: 56836143743281, a: true, o: ['S'] },
      { id: 56836143776049, a: true, o: ['L'] },
      { id: 56836143808817, a: true, o: ['M'] },
      { id: 56836143841585, a: true, o: ['XL'] },
    ],
    url: 'https://nike-makknzjs.myshopify.com/products/sweatshirt-plus',
  },
  {
    id: 'hoodie',
    name: 'Hoodie',
    vendor: 'Nike',
    type: 'From the original lookbook',
    price: 4500,
    image: `${ASSET_BASE}/source-hoodie.webp`,
    width: 400,
    height: 555,
    sheetHeight: 222,
    optionName: 'Size',
    sizes: ['S', 'L', 'M', 'XL'],
    variants: [
      { id: 56836002185521, a: true, o: ['S'] },
      { id: 56836002218289, a: true, o: ['L'] },
      { id: 56836002251057, a: true, o: ['M'] },
      { id: 56836002283825, a: true, o: ['XL'] },
    ],
    url: 'https://nike-makknzjs.myshopify.com/products/hoodie',
  },
  {
    id: 'air-jordan-12-retro-copy',
    name: 'Luka 5',
    vendor: 'Nikey | Password: 1',
    type: 'From the original lookbook',
    price: 3400,
    image: `${ASSET_BASE}/source-air-jordan-12-retro-copy.webp`,
    width: 400,
    height: 400,
    sheetHeight: 160,
    optionName: 'Shoe size',
    sizes: ['40', '41', '42', '43', '44', '45', '46'],
    variants: [
      { id: 57015176364337, a: true, o: ['40'] },
      { id: 57015176397105, a: true, o: ['41'] },
      { id: 57015176429873, a: true, o: ['42'] },
      { id: 57015176462641, a: true, o: ['43'] },
      { id: 57015176495409, a: true, o: ['44'] },
      { id: 57015176528177, a: true, o: ['45'] },
      { id: 57015176560945, a: true, o: ['46'] },
    ],
    url: 'https://nike-makknzjs.myshopify.com/products/air-jordan-12-retro-copy',
  },
];

export const RUNWAY_LOOKS: RunwayLook[] = [
  {
    index: 0,
    key: 'bndthK',
    name: 'The City Edit',
    description: 'A charcoal knit and easy denim.',
    image640: `${ASSET_BASE}/model-1-640.webp`,
    image1080: `${ASSET_BASE}/original-look-1.webp`,
    piecesLabel: '3 pieces',
    pieces: [
      { productId: 'tatum-5-orbit-copy' },
      { productId: 'tshirt' },
      { productId: 'sweatshirt' },
    ],
    pins: [
      { number: 1, productId: 'tatum-5-orbit-copy', productName: 'Air Jordan 12 Retro', left: '47%', top: '27%' },
      { number: 2, productId: 'tshirt', productName: 'Tshirt', left: '48%', top: '58%' },
      { number: 3, productId: 'sweatshirt', productName: 'Sweatshirt', left: '45%', top: '96%' },
    ],
  },
  {
    index: 1,
    key: 'XckgG6',
    name: 'Gallery Opening',
    description: 'A clean white tee and relaxed denim.',
    image640: `${ASSET_BASE}/model-5-640.webp`,
    image1080: `${ASSET_BASE}/original-look-5.webp`,
    piecesLabel: '3 pieces',
    pieces: [
      { productId: 'tatum-5-orbit' },
      { productId: 'hoodie-black', tag: 'New' },
      { productId: 'tshirt' },
    ],
    pins: [
      { number: 1, productId: 'tatum-5-orbit', productName: 'Tatum 5 Orbit', left: '50%', top: '28%' },
      { number: 2, productId: 'hoodie-black', productName: 'Hoodie Black', left: '48%', top: '58%' },
      { number: 3, productId: 'tshirt', productName: 'Tshirt', left: '45%', top: '88%' },
    ],
  },
  {
    index: 2,
    key: 'rLfAhC',
    name: 'Gallery Opening',
    description: 'Olive knitwear. A grounded palette.',
    image640: `${ASSET_BASE}/model-4-640.webp`,
    image1080: `${ASSET_BASE}/original-look-4.webp`,
    piecesLabel: '3 pieces',
    pieces: [
      { productId: 'sweatshirt-plus' },
      { productId: 'tatum-5-orbit', tag: 'New' },
      { productId: 'tshirt' },
    ],
    pins: [
      { number: 1, productId: 'sweatshirt-plus', productName: 'Sweatshirt Plus', left: '50%', top: '28%' },
      { number: 2, productId: 'tatum-5-orbit', productName: 'Tatum 5 Orbit', left: '48%', top: '58%' },
      { number: 3, productId: 'tshirt', productName: 'Tshirt', left: '45%', top: '88%' },
    ],
  },
  {
    index: 3,
    key: 'FKg67q',
    name: 'Studio Day',
    description: 'Black, white and laid-back denim.',
    image640: `${ASSET_BASE}/model-6-640.webp`,
    image1080: `${ASSET_BASE}/original-look-6.webp`,
    piecesLabel: '3 pieces',
    pieces: [
      { productId: 'hoodie-black' },
      { productId: 'tatum-5-orbit-copy' },
      { productId: 'tshirt' },
    ],
    pins: [
      { number: 1, productId: 'hoodie-black', productName: 'Hoodie Black', left: '50%', top: '28%' },
      { number: 2, productId: 'tatum-5-orbit-copy', productName: 'Air Jordan 12 Retro', left: '48%', top: '58%' },
      { number: 3, productId: 'tshirt', productName: 'Tshirt', left: '45%', top: '88%' },
    ],
  },
  {
    index: 4,
    key: '8KREEE',
    name: 'Studio Day',
    description: 'Burgundy layers. A tailored perspective.',
    image640: `${ASSET_BASE}/model-3-640.webp`,
    image1080: `${ASSET_BASE}/original-look-3.webp`,
    piecesLabel: '3 pieces',
    pieces: [
      { productId: 'sweatshirt' },
      { productId: 'tatum-5-orbit' },
      { productId: 'tshirt' },
    ],
    pins: [
      { number: 1, productId: 'sweatshirt', productName: 'Sweatshirt', left: '50%', top: '28%' },
      { number: 2, productId: 'tatum-5-orbit', productName: 'Tatum 5 Orbit', left: '48%', top: '58%' },
      { number: 3, productId: 'tshirt', productName: 'Tshirt', left: '45%', top: '88%' },
    ],
  },
  {
    index: 5,
    key: 'N3bfm9',
    name: 'Studio Day',
    description: 'A grey crew and your favourite denim.',
    image640: `${ASSET_BASE}/model-2-640.webp`,
    image1080: `${ASSET_BASE}/original-look-2.webp`,
    piecesLabel: '3 pieces',
    pieces: [
      { productId: 'hoodie' },
      { productId: 'air-jordan-12-retro-copy' },
      { productId: 'tshirt' },
    ],
    pins: [
      { number: 1, productId: 'hoodie', productName: 'Hoodie', left: '50%', top: '28%' },
      { number: 2, productId: 'air-jordan-12-retro-copy', productName: 'Luka 5', left: '48%', top: '58%' },
      { number: 3, productId: 'tshirt', productName: 'Tshirt', left: '45%', top: '88%' },
    ],
  },
];

export const NATIVE_CATALOG: NativeCatalog = {
  source: 'https://nike-makknzjs.myshopify.com/pages/runway',
  looks: RUNWAY_LOOKS.map((look) => ({
    name: look.name,
    description: look.description,
    image: look.image640,
    products: look.pieces.map((p) => p.productId),
  })),
  items: CATALOG_ITEMS,
};

export function validateCatalog(catalog: NativeCatalog): NativeCatalog {
  if (!catalog || !Array.isArray(catalog.items)) {
    throw new Error('The product list could not load.');
  }
  for (const item of catalog.items) {
    if (
      typeof item.id !== 'string' ||
      !item.id ||
      typeof item.name !== 'string' ||
      !item.name ||
      typeof item.price !== 'number' ||
      !Number.isFinite(item.price) ||
      item.price < 0 ||
      !Array.isArray(item.variants)
    ) {
      throw new Error('The product list is unavailable.');
    }
    for (const v of item.variants) {
      if (
        !Number.isSafeInteger(v.id) ||
        typeof v.a !== 'boolean' ||
        !Array.isArray(v.o) ||
        v.o.some((opt) => typeof opt !== 'string')
      ) {
        throw new Error('The product list is unavailable.');
      }
    }
  }
  return catalog;
}

export function formatMoney(amount: number): string {
  const rounded = Math.round(amount);
  return `KSh ${rounded.toLocaleString('en-US')}`;
}

export function getCatalogItemById(id: string): CatalogItem | undefined {
  return CATALOG_ITEMS.find((item) => item.id === id);
}
