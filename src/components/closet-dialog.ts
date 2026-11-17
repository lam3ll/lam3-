import { RUNWAY_LOOKS } from '../data/catalog';
import {
  ARCHIVE_LOOK_CATEGORIES,
  type ClosetCategory,
  type ClosetOutfit,
  addClosetOutfit,
  createClosetOutfit,
  filterByCategory,
  getWornOutfits,
  loadClosetOutfits,
  removeClosetOutfit,
  saveClosetOutfits,
  setOutfitWorn,
} from '../logic/closet-store';

export interface ClosetDialogCallbacks {
  onWornOutfitsChange: (wornOutfits: ClosetOutfit[], focusOutfitId?: string) => void;
  onSelectArchiveLook: (lookIndex: number) => void;
  onNotify: (message: string) => void;
}

type ShowcaseTab = 'all' | 'uploads' | 'archive';
type CategoryFilter = 'all' | ClosetCategory;

async function fileToResizedDataUrl(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxH = 1100;
      const maxW = 900;
      let w = img.naturalWidth || 640;
      let h = img.naturalHeight || 960;
      if (h > maxH) {
        w = Math.round((w * maxH) / h);
        h = maxH;
      }
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const webp = canvas.toDataURL('image/webp', 0.86);
        if (webp.startsWith('data:image/')) {
          resolve(webp);
          return;
        }
      } catch {
        // Fallback to rawUrl
      }
      resolve(rawUrl);
    };
    img.onerror = () => resolve(rawUrl);
    img.src = rawUrl;
  });
}

export class VirtualClosetController {
  private outfits: ClosetOutfit[] = [];
  private activeTab: ShowcaseTab = 'all';
  private activeCategory: CategoryFilter = 'all';
  private pendingImageDataUrl = '';
  private callbacks: ClosetDialogCallbacks;

  private dialog: HTMLDialogElement | null;
  private openBtn: HTMLElement | null;
  private uploadTriggerBtn: HTMLElement | null;
  private closeBtn: HTMLElement | null;
  private fileInput: HTMLInputElement | null;
  private dropZone: HTMLElement | null;
  private previewImg: HTMLImageElement | null;
  private previewEmpty: HTMLElement | null;
  private nameInput: HTMLInputElement | null;
  private categoryInput: HTMLSelectElement | null;
  private piecesInput: HTMLInputElement | null;
  private noteInput: HTMLInputElement | null;
  private errorEl: HTMLElement | null;
  private saveOnlyBtn: HTMLButtonElement | null;
  private saveWearBtn: HTMLButtonElement | null;
  private gridEl: HTMLElement | null;
  private tabsContainer: HTMLElement | null;
  private catFiltersContainer: HTMLElement | null;

  constructor(callbacks: ClosetDialogCallbacks) {
    this.callbacks = callbacks;
    this.dialog = document.getElementById('closet-dialog') as HTMLDialogElement | null;
    this.openBtn = document.getElementById('open-closet');
    this.uploadTriggerBtn = document.getElementById('open-upload');
    this.closeBtn = document.getElementById('close-closet');
    this.fileInput = document.getElementById('closet-file-input') as HTMLInputElement | null;
    this.dropZone = document.getElementById('closet-dropzone');
    this.previewImg = document.getElementById('closet-preview-img') as HTMLImageElement | null;
    this.previewEmpty = document.getElementById('closet-preview-empty');
    this.nameInput = document.getElementById('closet-name-input') as HTMLInputElement | null;
    this.categoryInput = document.getElementById('closet-category-input') as HTMLSelectElement | null;
    this.piecesInput = document.getElementById('closet-pieces-input') as HTMLInputElement | null;
    this.noteInput = document.getElementById('closet-note-input') as HTMLInputElement | null;
    this.errorEl = document.getElementById('closet-form-error');
    this.saveOnlyBtn = document.getElementById('closet-save-btn') as HTMLButtonElement | null;
    this.saveWearBtn = document.getElementById('closet-wear-btn') as HTMLButtonElement | null;
    this.gridEl = document.getElementById('closet-grid');
    this.tabsContainer = document.getElementById('closet-tabs');
    this.catFiltersContainer = document.getElementById('closet-category-filters');

    this.outfits = loadClosetOutfits();
    this.bindEvents();
    this.updateCounts();
    this.renderGrid();
  }

  public getInitialWornOutfits(): ClosetOutfit[] {
    return getWornOutfits(this.outfits);
  }

  public openModal(focusUpload = false): void {
    this.renderGrid();
    if (this.dialog && !this.dialog.open) {
      this.dialog.showModal();
    }
    if (focusUpload) {
      this.nameInput?.focus();
    }
  }

  private bindEvents(): void {
    this.openBtn?.addEventListener('click', () => this.openModal(false));
    this.uploadTriggerBtn?.addEventListener('click', () => this.openModal(true));
    this.closeBtn?.addEventListener('click', () => this.dialog?.close());

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

    this.fileInput?.addEventListener('change', async () => {
      const file = this.fileInput?.files?.[0];
      if (!file) return;
      await this.handleSelectedFile(file);
    });

    this.dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone?.classList.add('is-over');
    });

    this.dropZone?.addEventListener('dragleave', () => {
      this.dropZone?.classList.remove('is-over');
    });

    this.dropZone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.dropZone?.classList.remove('is-over');
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      await this.handleSelectedFile(file);
    });

    this.saveOnlyBtn?.addEventListener('click', () => this.submitOutfit(false));
    this.saveWearBtn?.addEventListener('click', () => this.submitOutfit(true));

    this.tabsContainer?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-closet-tab]');
      if (!btn) return;
      const tab = btn.dataset.closetTab as ShowcaseTab | undefined;
      if (!tab) return;
      this.activeTab = tab;
      this.tabsContainer?.querySelectorAll<HTMLButtonElement>('[data-closet-tab]').forEach((el) => {
        const active = el.dataset.closetTab === tab;
        el.setAttribute('aria-pressed', String(active));
        el.classList.toggle('is-active', active);
      });
      this.renderGrid();
    });

    this.catFiltersContainer?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-closet-cat]');
      if (!btn) return;
      const cat = btn.dataset.closetCat as CategoryFilter | undefined;
      if (!cat) return;
      this.activeCategory = cat;
      this.catFiltersContainer
        ?.querySelectorAll<HTMLButtonElement>('[data-closet-cat]')
        .forEach((el) => {
          const active = el.dataset.closetCat === cat;
          el.setAttribute('aria-pressed', String(active));
          el.classList.toggle('is-active', active);
        });
      this.renderGrid();
    });

    this.gridEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const wearBtn = target?.closest<HTMLButtonElement>('[data-closet-wear]');
      if (wearBtn) {
        const id = wearBtn.dataset.closetWear;
        if (!id) return;
        const existing = this.outfits.find((o) => o.id === id);
        if (!existing) return;
        const nextWorn = !existing.worn;
        this.outfits = setOutfitWorn(this.outfits, id, nextWorn);
        saveClosetOutfits(this.outfits);
        this.updateCounts();
        this.renderGrid();
        this.callbacks.onWornOutfitsChange(
          getWornOutfits(this.outfits),
          nextWorn ? id : undefined
        );
        this.callbacks.onNotify(
          nextWorn ? `Wearing "${existing.name}" on runway` : `Removed "${existing.name}" from runway`
        );
        if (nextWorn) {
          this.dialog?.close();
        }
        return;
      }

      const deleteBtn = target?.closest<HTMLButtonElement>('[data-closet-delete]');
      if (deleteBtn) {
        const id = deleteBtn.dataset.closetDelete;
        if (!id) return;
        const existing = this.outfits.find((o) => o.id === id);
        this.outfits = removeClosetOutfit(this.outfits, id);
        saveClosetOutfits(this.outfits);
        this.updateCounts();
        this.renderGrid();
        if (existing?.worn) {
          this.callbacks.onWornOutfitsChange(getWornOutfits(this.outfits));
        }
        this.callbacks.onNotify('Outfit removed from virtual closet');
        return;
      }

      const archiveBtn = target?.closest<HTMLButtonElement>('[data-closet-archive]');
      if (archiveBtn) {
        const idx = Number(archiveBtn.dataset.closetArchive);
        if (Number.isInteger(idx)) {
          this.callbacks.onSelectArchiveLook(idx);
          this.dialog?.close();
        }
      }
    });
  }

  private async handleSelectedFile(file: File): Promise<void> {
    this.setError('');
    if (!file.type.startsWith('image/')) {
      this.setError('Please select an image file (PNG, JPG, or WebP).');
      return;
    }
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      this.pendingImageDataUrl = dataUrl;
      if (this.previewImg && this.previewEmpty) {
        this.previewImg.src = dataUrl;
        this.previewImg.hidden = false;
        this.previewEmpty.hidden = true;
      }
      if (this.nameInput && !this.nameInput.value.trim()) {
        const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        if (base) {
          this.nameInput.value = base.slice(0, 36);
        }
      }
    } catch {
      this.setError('Could not process that image file.');
    }
  }

  private setError(msg: string): void {
    if (!this.errorEl) return;
    this.errorEl.textContent = msg;
    this.errorEl.hidden = !msg;
  }

  private submitOutfit(wearImmediately: boolean): void {
    this.setError('');
    const name = this.nameInput?.value.trim() || '';
    const category = this.categoryInput?.value || 'Streetwear';
    const piecesRaw = this.piecesInput?.value || '';
    const pieces = piecesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const note = this.noteInput?.value.trim() || '';

    try {
      const outfit = createClosetOutfit({
        name,
        category,
        note,
        pieces,
        imageDataUrl: this.pendingImageDataUrl,
        worn: wearImmediately,
      });

      const nextList = addClosetOutfit(this.outfits, outfit);
      const saved = saveClosetOutfits(nextList);
      if (!saved) {
        this.setError('Storage is full. Remove an older uploaded outfit first.');
        return;
      }
      this.outfits = nextList;
      this.resetForm();
      this.updateCounts();
      this.renderGrid();

      if (wearImmediately) {
        this.callbacks.onWornOutfitsChange(getWornOutfits(this.outfits), outfit.id);
        this.callbacks.onNotify(`Wearing "${outfit.name}" on runway`);
        this.dialog?.close();
      } else {
        this.callbacks.onNotify(`Saved "${outfit.name}" (${outfit.category}) to virtual closet`);
      }
    } catch (err) {
      this.setError(err instanceof Error ? err.message : 'Unable to save outfit.');
    }
  }

  private resetForm(): void {
    this.pendingImageDataUrl = '';
    if (this.fileInput) this.fileInput.value = '';
    if (this.nameInput) this.nameInput.value = '';
    if (this.categoryInput) this.categoryInput.value = 'Streetwear';
    if (this.piecesInput) this.piecesInput.value = '';
    if (this.noteInput) this.noteInput.value = '';
    if (this.previewImg) {
      this.previewImg.removeAttribute('src');
      this.previewImg.hidden = true;
    }
    if (this.previewEmpty) {
      this.previewEmpty.hidden = false;
    }
  }

  private updateCounts(visibleCount?: number): void {
    const totalCount = visibleCount ?? this.outfits.length + RUNWAY_LOOKS.length;
    document.querySelectorAll<HTMLElement>('[data-closet-count]').forEach((el) => {
      el.textContent = String(this.outfits.length);
    });
    document.querySelectorAll<HTMLElement>('[data-closet-total]').forEach((el) => {
      el.textContent = `${totalCount} ${totalCount === 1 ? 'look' : 'looks'}`;
    });
  }

  private renderGrid(): void {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';

    const showUploads = this.activeTab === 'all' || this.activeTab === 'uploads';
    const showArchive = this.activeTab === 'all' || this.activeTab === 'archive';

    const filteredUploads = showUploads
      ? filterByCategory(this.outfits, this.activeCategory)
      : [];

    const archiveWithCats = RUNWAY_LOOKS.map((look) => ({
      look,
      category: ARCHIVE_LOOK_CATEGORIES[look.key] ?? ('Streetwear' as ClosetCategory),
    }));
    const filteredArchive = showArchive
      ? filterByCategory(archiveWithCats, this.activeCategory)
      : [];

    const renderedTotal = filteredUploads.length + filteredArchive.length;
    this.updateCounts(renderedTotal);

    if (renderedTotal === 0) {
      const empty = document.createElement('p');
      empty.className = 'closet-empty';
      if (this.activeTab === 'uploads' && this.outfits.length === 0) {
        empty.textContent =
          'No uploaded outfits yet. Drop an outfit photo above to save it to your categorized showcase.';
      } else {
        empty.textContent = `No ${this.activeCategory === 'all' ? '' : `${this.activeCategory} `}looks in this view yet.`;
      }
      this.gridEl.appendChild(empty);
      return;
    }

    for (const outfit of filteredUploads) {
      const card = document.createElement('article');
      card.className = 'closet-card';
      if (outfit.worn) card.classList.add('is-worn');

      const media = document.createElement('div');
      media.className = 'closet-card-media';
      const img = document.createElement('img');
      img.src = outfit.imageDataUrl;
      img.alt = outfit.name;
      img.loading = 'lazy';
      media.appendChild(img);

      const body = document.createElement('div');
      body.className = 'closet-card-body';

      const meta = document.createElement('p');
      meta.className = 'closet-card-meta';
      meta.textContent = outfit.worn
        ? `My Upload · ${outfit.category} · Wearing on runway`
        : `My Upload · ${outfit.category}`;

      const title = document.createElement('h3');
      title.className = 'closet-card-title';
      title.textContent = outfit.name;

      const desc = document.createElement('p');
      desc.className = 'closet-card-desc';
      desc.textContent = outfit.pieces.join(' · ');

      const actions = document.createElement('div');
      actions.className = 'closet-card-actions';

      const wearBtn = document.createElement('button');
      wearBtn.type = 'button';
      wearBtn.className = 'closet-btn-primary';
      wearBtn.dataset.closetWear = outfit.id;
      wearBtn.textContent = outfit.worn ? 'Remove from runway' : 'Wear on runway';

      const delBtn = document.createElement('button');
      deleteBtnProps(delBtn, outfit);

      actions.append(wearBtn, delBtn);
      body.append(meta, title, desc, actions);
      card.append(media, body);
      this.gridEl.appendChild(card);
    }

    for (const { look, category } of filteredArchive) {
      const card = document.createElement('article');
      card.className = 'closet-card';

      const media = document.createElement('div');
      media.className = 'closet-card-media';
      const img = document.createElement('img');
      img.src = look.image640;
      img.alt = look.name;
      img.loading = 'lazy';
      media.appendChild(img);

      const body = document.createElement('div');
      body.className = 'closet-card-body';

      const meta = document.createElement('p');
      meta.className = 'closet-card-meta';
      meta.textContent = `Look 0${look.index + 1} · ${category} · ${look.piecesLabel}`;

      const title = document.createElement('h3');
      title.className = 'closet-card-title';
      title.textContent = look.name;

      const desc = document.createElement('p');
      desc.className = 'closet-card-desc';
      desc.textContent = look.description;

      const actions = document.createElement('div');
      actions.className = 'closet-card-actions';

      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'closet-btn-secondary';
      viewBtn.dataset.closetArchive = String(look.index);
      viewBtn.textContent = 'Wear on runway';

      actions.appendChild(viewBtn);
      body.append(meta, title, desc, actions);
      card.append(media, body);
      this.gridEl.appendChild(card);
    }
  }
}

function deleteBtnProps(btn: HTMLButtonElement, outfit: ClosetOutfit): void {
  btn.type = 'button';
  btn.className = 'closet-btn-ghost';
  btn.dataset.closetDelete = outfit.id;
  btn.setAttribute('aria-label', `Delete ${outfit.name}`);
  btn.textContent = 'Delete';
}
