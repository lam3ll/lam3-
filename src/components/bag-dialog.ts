import { NATIVE_CATALOG, formatMoney } from '../data/catalog';
import {
  type BagEntry,
  addItemsToBag,
  buildShortlistText,
  getBagCount,
  getBagSubtotal,
  loadBagEntries,
  removeBagEntry,
  resolveBagItems,
  saveBagEntries,
  verifyShopHostname,
} from '../logic/bag-store';

export interface StylingBagOptions {
  onInspectPiece?: (productId: string) => void;
}

export class StylingBagController {
  private entries: BagEntry[] = [];
  private toastTimer: number | null = null;
  private onInspectPiece?: (productId: string) => void;
  private dialog: HTMLDialogElement | null;
  private itemsEl: HTMLElement | null;
  private totalEl: HTMLElement | null;
  private exportBtn: HTMLButtonElement | null;
  private statusEl: HTMLElement | null;
  private openBtn: HTMLElement | null;
  private closeBtn: HTMLElement | null;

  constructor(options?: StylingBagOptions) {
    this.onInspectPiece = options?.onInspectPiece;
    this.dialog = document.getElementById('bag-dialog') as HTMLDialogElement | null;
    this.itemsEl = document.getElementById('bag-items');
    this.totalEl = document.getElementById('bag-total');
    this.exportBtn = document.getElementById('export-bag') as HTMLButtonElement | null;
    this.statusEl = document.getElementById('bag-status');
    this.openBtn = document.getElementById('open-bag');
    this.closeBtn = document.getElementById('close-bag');

    this.entries = loadBagEntries();
    this.bindEvents();
    this.updateCounts();
    this.renderDialog();
  }

  private bindEvents(): void {
    this.openBtn?.addEventListener('click', () => {
      this.renderDialog();
      if (this.dialog && !this.dialog.open) {
        this.dialog.showModal();
      }
    });

    this.closeBtn?.addEventListener('click', () => {
      this.dialog?.close();
    });

    this.dialog?.addEventListener('click', (e) => {
      if (!this.dialog) return;
      const rect = this.dialog.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) {
        this.dialog.close();
      }
    });

    this.itemsEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const inspectLink = target?.closest<HTMLAnchorElement>('[data-inspect-piece]');
      if (inspectLink) {
        e.preventDefault();
        const productId = inspectLink.dataset.inspectPiece;
        this.dialog?.close();
        if (productId) {
          this.onInspectPiece?.(productId);
        }
        return;
      }

      const btn = target?.closest<HTMLButtonElement>('[data-remove-variant]');
      if (!btn) return;
      const id = Number(btn.dataset.removeVariant);
      if (!Number.isSafeInteger(id)) return;
      this.entries = removeBagEntry(this.entries, id);
      saveBagEntries(this.entries);
      this.updateCounts();
      this.renderDialog();
    });

    this.exportBtn?.addEventListener('click', () => {
      if (this.entries.length === 0) return;
      const text = buildShortlistText(this.entries, NATIVE_CATALOG);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'la-mer-outfit-shortlist.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  public add(requests: Array<{ id: number; quantity?: number }>): void {
    const result = addItemsToBag(this.entries, requests, NATIVE_CATALOG);
    this.entries = result.entries;
    saveBagEntries(this.entries);
    this.updateCounts();
    this.renderDialog();
    this.showToast(result.message);
  }

  public showToast(message: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.classList.add('is-on');
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.statusEl?.classList.remove('is-on');
      this.toastTimer = null;
    }, 2500);
  }

  private updateCounts(): void {
    const count = getBagCount(this.entries);
    document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
      el.textContent = String(count);
    });
  }

  private renderDialog(): void {
    if (!this.itemsEl || !this.totalEl || !this.exportBtn) return;
    const rows = resolveBagItems(this.entries, NATIVE_CATALOG);
    this.itemsEl.innerHTML = '';

    if (rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'bag-note';
      empty.textContent =
        'Your styling bag is empty. Choose a size beside a piece to save it.';
      this.itemsEl.appendChild(empty);
      this.totalEl.textContent = '';
      this.exportBtn.disabled = true;
      return;
    }

    for (const row of rows) {
      const safeUrl = verifyShopHostname(row.item.url);

      const rowEl = document.createElement('div');
      rowEl.className = 'bag-row';

      const img = document.createElement('img');
      img.src = row.item.image;
      img.alt = row.item.name;
      img.width = 60;
      img.height = 80;

      const info = document.createElement('div');
      info.className = 'bag-row-info';

      const title = document.createElement('h3');
      title.textContent = row.item.name;

      const meta = document.createElement('p');
      meta.textContent = `Size ${row.sizeLabel} · Quantity ${row.entry.quantity} · ${formatMoney(row.item.price)}`;

      const link = document.createElement('a');
      link.href = safeUrl;
      if (safeUrl.startsWith('#')) {
        link.dataset.inspectPiece = row.item.id;
        link.textContent = 'View look on runway ↗';
      } else {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'View original piece ↗';
      }

      info.append(title, meta, link);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'bag-remove';
      removeBtn.dataset.removeVariant = String(row.variant.id);
      removeBtn.setAttribute('aria-label', `Remove ${row.item.name}`);
      removeBtn.textContent = '×';

      rowEl.append(img, info, removeBtn);
      this.itemsEl.appendChild(rowEl);
    }

    const subtotal = getBagSubtotal(this.entries, NATIVE_CATALOG);
    this.totalEl.textContent = `Reference subtotal ${formatMoney(subtotal)}`;
    this.exportBtn.disabled = false;
  }
}
