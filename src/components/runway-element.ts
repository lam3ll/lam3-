import {
  CATALOG_ITEMS,
  type CatalogItem,
  RUNWAY_LOOKS,
  formatMoney,
} from '../data/catalog';
import { type ClosetOutfit } from '../logic/closet-store';
import {
  clamp,
  computeBodyCount,
  computeClassicSlotPose,
  computeFeetOffset,
  computeFrameHeight,
  computeModelHeight,
  computeRingSlotPose,
  shortestLoopDelta,
  stepSpring,
  wrapMod,
} from '../logic/runway-math';

interface NormalizedLook {
  index: number;
  key: string;
  name: string;
  description: string;
  image640: string;
  image1080: string;
  piecesLabel: string;
  isCustom: boolean;
  customOutfit?: ClosetOutfit;
  pieces: Array<{
    number: number;
    item?: CatalogItem;
    tag?: string;
    customTitle?: string;
    customVendor?: string;
    customImage?: string;
  }>;
  pins: Array<{
    number: number;
    productName: string;
    left: string;
    top: string;
  }>;
}

interface BodyState {
  el: HTMLElement;
  hit: HTMLButtonElement | null;
  art: HTMLElement | null;
  lookIndex: number;
  w: number;
  x: number;
  v: number;
  g: number;
  from: number;
  goal: number;
  trip: boolean;
  lastBlur: number;
}

export type BagAdder = (items: Array<{ id: number; quantity?: number }>) => void;

const K_SPRING = 95;
const C_SPRING = 2 * Math.sqrt(K_SPRING);

const PICKER_STYLE_PROPS = [
  '--rw-panel',
  '--rw-text',
  '--rw-muted',
  '--rw-line',
  '--rw-accent',
  '--rw-on-accent',
  '--rw-btn-bg',
  '--rw-btn-fg',
  '--rw-btn-radius',
  '--rw-pill-radius',
  '--rw-bar-r',
  '--rw-thumb-radius',
  '--rw-pt-size',
  '--rw-price',
  '--rw-opt',
  '--rw-ease',
  '--rw-ease-sheet',
  '--rw-ease-spring',
] as const;

export class RunwaySection extends HTMLElement {
  private looks: NormalizedLook[] = [];
  private bodies: BodyState[] = [];
  private heroes: HTMLElement[] = [];
  private panels: HTMLElement[] = [];
  private ticks: HTMLButtonElement[] = [];

  private stageEl!: HTMLElement;
  private actorsEl!: HTMLElement;
  private heroesEl!: HTMLElement;
  private controlsEl!: HTMLElement;
  private ticksEl!: HTMLElement;
  private autoBtn!: HTMLButtonElement;
  private liveEl!: HTMLElement;
  private piecesLabelEl!: HTMLElement;
  private panelEl!: HTMLElement;
  private lbEl!: HTMLElement;
  private lbStageEl!: HTMLElement;
  private lbKickerEl!: HTMLElement;
  private lbNameEl!: HTMLElement;
  private lbCloseEl!: HTMLButtonElement;
  private cursorEl: HTMLElement | null = null;
  private sheetHost: HTMLDivElement | null = null;
  private openSheetCard: HTMLElement | null = null;
  private openSheetOriginPickerParent: HTMLElement | null = null;

  private bagAdder: BagAdder | null = null;
  private onOpenCloset: (() => void) | null = null;
  private wornOutfits: ClosetOutfit[] = [];

  private index = 0;
  private target = 0;
  private cur = 0;
  private vel = 0;
  private still = false;
  private zoomed = false;
  private playing = false;
  private engaged = false;
  private panelHover = false;
  private visible = true;
  private dragging = false;
  private suppressClickUntil = 0;
  private wheelAcc = 0;
  private wheelLockedUntil = 0;

  private W = 1000;
  private H = 640;
  private fs = 1.08;
  private unit = 300;
  private isMobile = false;
  private mode: 'ring' | 'classic' = 'ring';
  private reducedMotion = false;
  private canHoverCursor = false;
  private latchedVh = 0;
  private latchedVw = 0;

  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTarget = 0;
  private dragAbandoned = false;
  private dragSamples: Array<{ x: number; time: number }> = [];

  private cursorX = 0;
  private cursorY = 0;
  private cursorTargetX = 0;
  private cursorTargetY = 0;
  private cursorRaf: number | null = null;
  private cursorEntered = false;

  private rafId: number | null = null;
  private lastFrameTime = 0;
  private autoTimer: number | null = null;
  private resizeTimer: number | null = null;
  private lbCloseTimer: number | null = null;

  private visObserver: IntersectionObserver | null = null;
  private revealObserver: IntersectionObserver | null = null;
  private stageResizeObserver: ResizeObserver | null = null;
  private cleanups: Array<() => void> = [];
  private initialized = false;
  private footOffsets = new Map<number, number>();
  private lastObservedStageW = 0;
  private lastObservedStageH = 0;

  public setBagAdder(adder: BagAdder): void {
    this.bagAdder = adder;
  }

  public setClosetHandler(handler: () => void): void {
    this.onOpenCloset = handler;
  }

  public syncWornOutfits(worn: ClosetOutfit[], focusOutfitId?: string): void {
    this.wornOutfits = worn;
    if (!this.initialized) return;

    const prevIndex = this.index;
    this.rebuildLooksAndDom(false);

    if (focusOutfitId) {
      const targetIdx = this.looks.findIndex((l) => l.customOutfit?.id === focusOutfitId);
      if (targetIdx >= 0) {
        this.engaged = true;
        this.play(false);
        this.go(targetIdx);
        return;
      }
    }

    const clampedIdx = clamp(prevIndex, 0, Math.max(0, this.looks.length - 1));
    this.index = clampedIdx;
    this.target = clampedIdx;
    this.cur = clampedIdx;
    this.setIndex(clampedIdx, true);
    this.measure();
    this.kick();
  }

  public selectLook(index: number): void {
    if (!this.initialized) return;
    if (index >= 0 && index < this.looks.length) {
      this.engaged = true;
      this.play(false);
      this.go(index);
    }
  }

  connectedCallback(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.canHoverCursor = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    this.classList.add('rw--js');
    this.buildShell();
    this.rebuildLooksAndDom(true);
    this.bindEvents();
    this.setupObservers();

    const startOffset = this.reducedMotion ? 0 : 1.15;
    this.index = 0;
    this.target = 0;
    this.cur = -startOffset;
    this.vel = 0;

    for (const body of this.bodies) {
      body.x = wrapMod(body.lookIndex, this.bodies.length) + startOffset;
      body.g = body.x;
      body.goal = body.x;
    }

    this.measure();
    this.setIndex(0, true);
    this.renderAll();

    if (this.reducedMotion) {
      this.classList.add('is-revealed');
      this.setStill(true);
      this.renderAll();
    } else {
      this.setStill(false);
      this.kick();
    }

    if (this.dataset.autoplay === 'true' && !this.reducedMotion) {
      this.play(true);
    } else {
      this.play(false);
    }
  }

  disconnectedCallback(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.cursorRaf !== null) cancelAnimationFrame(this.cursorRaf);
    if (this.autoTimer !== null) clearTimeout(this.autoTimer);
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    if (this.lbCloseTimer !== null) clearTimeout(this.lbCloseTimer);
    this.visObserver?.disconnect();
    this.revealObserver?.disconnect();
    this.stageResizeObserver?.disconnect();
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
    this.closeSheet(true);
    this.sheetHost?.remove();
    this.sheetHost = null;
  }

  private buildShell(): void {
    this.innerHTML = `
      <div class="rw__sticky">
        <div class="rw__grid">
          <div class="rw__left">
            <div class="rw__head">
              <div class="rw__intro">
                <h2 class="rw__title">Try the Look.</h2>
                <p class="rw__sub">Six looks, styled head to toe. Tap a pin to see the piece.</p>
              </div>
              <span class="rw__sr" aria-live="polite" aria-atomic="true" data-rw-live></span>
            </div>

            <div class="rw__stage" data-rw-stage tabindex="0" role="region" aria-roledescription="carousel" aria-label="Try the Look. — use arrow keys or swipe to change look">
              <div class="rw__actors" data-rw-actors></div>
              <div class="rw__heroes" data-rw-heroes></div>
              <span class="rw__sweep" aria-hidden="true"></span>
              <span class="rw__cursor" data-rw-cursor aria-hidden="true">
                <span class="rw__cursor-in">
                  <span class="rw__cursor-label rw__cursor-drag">Drag</span>
                  <span class="rw__cursor-label rw__cursor-view">View</span>
                </span>
              </span>
              <span class="rw__walk" aria-hidden="true"><span class="rw__walk-line"></span></span>
            </div>

            <div class="rw__controls">
              <button type="button" class="rw__icon" data-rw-prev aria-label="Previous look">
                <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M25 7H1M7 1L1 7l6 6"/>
                </svg>
              </button>
              <div class="rw__ticks" data-rw-ticks></div>
              <button type="button" class="rw__icon rw__auto" data-rw-auto aria-pressed="false" aria-label="Autoplay">
                <svg class="rw__auto-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4.5v15l12.5-7.5z"/>
                </svg>
                <svg class="rw__auto-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6.5 4.5h3.5v15H6.5zM14 4.5h3.5v15H14z"/>
                </svg>
              </button>
              <button type="button" class="rw__icon" data-rw-next aria-label="Next look">
                <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 7h24M19 1l6 6-6 6"/>
                </svg>
              </button>
            </div>

            <div class="rw__lb" data-rw-lb data-word="Look" role="region" aria-label="View look" aria-hidden="true">
              <div class="rw__lb-stage" data-rw-lb-stage></div>
              <div class="rw__lb-top">
                <p class="rw__lb-cap">
                  <span class="rw__lb-kicker" data-rw-lb-kicker></span>
                  <span class="rw__lb-name" data-rw-lb-name></span>
                </p>
                <button type="button" class="rw__lb-close" data-rw-zoom-close aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                    <path d="M5 5l14 14M19 5L5 19"/>
                  </svg>
                </button>
              </div>
              <p class="rw__lb-hint">Tap a dot to shop the piece</p>
            </div>
          </div>

          <aside class="rw__panel has-rule" data-rw-panel-wrap>
            <div class="rw__panel-inner">
              <div class="rw__panel-head">
                <h3 class="rw__panel-title">In this look</h3>
                <span class="rw__label" data-rw-pieces>3 pieces</span>
              </div>
              <div class="rw__panels" data-rw-panels></div>
            </div>
          </aside>
        </div>
      </div>
    `;

    this.stageEl = this.querySelector('[data-rw-stage]')!;
    this.actorsEl = this.querySelector('[data-rw-actors]')!;
    this.heroesEl = this.querySelector('[data-rw-heroes]')!;
    this.controlsEl = this.querySelector('.rw__controls')!;
    this.ticksEl = this.querySelector('[data-rw-ticks]')!;
    this.autoBtn = this.querySelector('[data-rw-auto]')!;
    this.liveEl = this.querySelector('[data-rw-live]')!;
    this.piecesLabelEl = this.querySelector('[data-rw-pieces]')!;
    this.panelEl = this.querySelector('[data-rw-panel-wrap]')!;
    this.lbEl = this.querySelector('[data-rw-lb]')!;
    this.lbStageEl = this.querySelector('[data-rw-lb-stage]')!;
    this.lbKickerEl = this.querySelector('[data-rw-lb-kicker]')!;
    this.lbNameEl = this.querySelector('[data-rw-lb-name]')!;
    this.lbCloseEl = this.querySelector('[data-rw-zoom-close]')!;
    this.cursorEl = this.querySelector('[data-rw-cursor]');

    if (this.canHoverCursor) {
      this.classList.add('rw--cursor');
    } else {
      this.cursorEl?.remove();
      this.cursorEl = null;
    }
  }

  private buildNormalizedLooks(): NormalizedLook[] {
    const baseLooks: NormalizedLook[] = RUNWAY_LOOKS.map((look) => ({
      index: look.index,
      key: look.key,
      name: look.name,
      description: look.description,
      image640: look.image640,
      image1080: look.image1080,
      piecesLabel: look.piecesLabel,
      isCustom: false,
      pieces: look.pieces.map((p, idx) => ({
        number: idx + 1,
        item: CATALOG_ITEMS.find((item) => item.id === p.productId),
        tag: p.tag,
      })),
      pins: look.pins.map((pin) => ({
        number: pin.number,
        productName: pin.productName,
        left: pin.left,
        top: pin.top,
      })),
    }));

    const customLooks: NormalizedLook[] = this.wornOutfits.map((outfit, idx) => {
      const lookIndex = baseLooks.length + idx;
      return {
        index: lookIndex,
        key: `custom_${outfit.id}`,
        name: outfit.name,
        description: outfit.note,
        image640: outfit.imageDataUrl,
        image1080: outfit.imageDataUrl,
        piecesLabel: `${outfit.pieces.length} ${outfit.pieces.length === 1 ? 'piece' : 'pieces'}`,
        isCustom: true,
        customOutfit: outfit,
        pieces: outfit.pieces.map((pieceName, pIdx) => ({
          number: pIdx + 1,
          customTitle: pieceName,
          customVendor: `Closet · ${outfit.category}`,
          customImage: outfit.imageDataUrl,
        })),
        pins: outfit.pieces.slice(0, 3).map((pieceName, pIdx) => ({
          number: pIdx + 1,
          productName: pieceName,
          left: pIdx === 0 ? '50%' : pIdx === 1 ? '48%' : '46%',
          top: pIdx === 0 ? '28%' : pIdx === 1 ? '55%' : '82%',
        })),
      };
    });

    return [...baseLooks, ...customLooks];
  }

  private rebuildLooksAndDom(isInitial: boolean): void {
    this.closeSheet(true);
    if (this.zoomed) this.closeLightbox(true);

    this.looks = this.buildNormalizedLooks();
    const lookCount = this.looks.length;
    const bodyCount = computeBodyCount(lookCount);

    this.actorsEl.innerHTML = '';
    this.heroesEl.innerHTML = '';
    this.ticksEl.innerHTML = '';
    const panelsWrap = this.querySelector('[data-rw-panels]')!;
    panelsWrap.innerHTML = '';

    this.bodies = [];
    this.heroes = [];
    this.ticks = [];
    this.panels = [];

    for (let i = 0; i < lookCount; i++) {
      const look = this.looks[i];
      const bodyEl = this.createBodyElement(look, false);
      this.actorsEl.appendChild(bodyEl);
      this.bodies.push({
        el: bodyEl,
        hit: bodyEl.querySelector('.rw__hit'),
        art: bodyEl.querySelector('.rw__art'),
        lookIndex: i,
        w: 300,
        x: i,
        v: 0,
        g: i,
        from: i,
        goal: i,
        trip: false,
        lastBlur: 0,
      });
    }

    for (let a = lookCount; a < bodyCount; a++) {
      const lookIdx = a % lookCount;
      const sourceBody = this.bodies[lookIdx].el;
      const clone = sourceBody.cloneNode(true) as HTMLElement;
      clone.setAttribute('data-rw-clone', '');
      clone.setAttribute('data-index', String(a));
      clone.querySelectorAll('img').forEach((img) => {
        img.loading = 'lazy';
        this.attachImageDecode(img);
      });
      this.actorsEl.appendChild(clone);
      this.bodies.push({
        el: clone,
        hit: clone.querySelector('.rw__hit'),
        art: clone.querySelector('.rw__art'),
        lookIndex: lookIdx,
        w: 300,
        x: a,
        v: 0,
        g: a,
        from: a,
        goal: a,
        trip: false,
        lastBlur: 0,
      });
    }

    for (let i = 0; i < lookCount; i++) {
      const look = this.looks[i];
      const heroEl = this.createHeroElement(look, i === this.index);
      this.heroesEl.appendChild(heroEl);
      this.heroes.push(heroEl);

      const tickBtn = this.createTickElement(look, i === this.index);
      this.ticksEl.appendChild(tickBtn);
      this.ticks.push(tickBtn);

      const panelEl = this.createPanelElement(look, i === this.index);
      panelsWrap.appendChild(panelEl);
      this.panels.push(panelEl);

      this.probeFeet(look);
    }

    this.querySelectorAll<HTMLImageElement>('img[data-model-image]').forEach((img) => {
      this.attachImageDecode(img);
    });

    if (!isInitial) {
      for (const body of this.bodies) {
        const idx = body.lookIndex;
        const foot = this.footOffsets.get(idx);
        if (foot !== undefined) {
          body.el.style.setProperty('--rw-foot', String(foot));
        }
      }
      for (let i = 0; i < this.heroes.length; i++) {
        const foot = this.footOffsets.get(i);
        if (foot !== undefined) {
          this.heroes[i].style.setProperty('--rw-foot', String(foot));
        }
      }
    }
  }

  private createBodyElement(look: NormalizedLook, isClone: boolean): HTMLElement {
    const model = document.createElement('div');
    model.className = 'rw__model';
    model.setAttribute('data-rw-model', '');
    model.setAttribute('data-index', String(look.index));
    model.setAttribute('aria-hidden', 'true');

    const shadow = document.createElement('span');
    shadow.className = 'rw__shadow';

    const fig = document.createElement('div');
    fig.className = 'rw__figure';
    fig.style.setProperty('--rw-ar', '0.5625');

    const art = document.createElement('div');
    art.className = 'rw__art';

    const img = this.createModelImg(look, isClone ? 'lazy' : 'eager');
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'rw__hit';
    hit.setAttribute('data-rw-go', String(look.index));
    hit.setAttribute('aria-label', `Look ${look.index + 1}: ${look.name}`);
    hit.tabIndex = -1;

    art.append(img, hit);
    fig.appendChild(art);
    model.append(shadow, fig);
    return model;
  }

  private createHeroElement(look: NormalizedLook, isOn: boolean): HTMLElement {
    const hero = document.createElement('div');
    hero.className = `rw__hero${isOn ? ' is-on' : ''}`;
    hero.setAttribute('data-rw-hero', '');
    hero.setAttribute('data-index', String(look.index));
    hero.setAttribute('data-name', look.name);
    hero.setAttribute('data-label', `Look ${look.index + 1}: ${look.name}`);
    hero.setAttribute('data-probe', look.image640);
    hero.setAttribute('aria-hidden', String(!isOn));

    const morph = document.createElement('div');
    morph.className = 'rw__morph';

    const shadow = document.createElement('span');
    shadow.className = 'rw__shadow';

    const fig = document.createElement('div');
    fig.className = 'rw__figure';
    fig.style.setProperty('--rw-ar', '0.5625');

    const art = document.createElement('div');
    art.className = 'rw__art';

    const img = this.createModelImg(look, 'eager');
    const zoomBtn = document.createElement('button');
    zoomBtn.type = 'button';
    zoomBtn.className = 'rw__zoom';
    zoomBtn.setAttribute('data-rw-zoom', '');
    zoomBtn.setAttribute('aria-label', `View look: ${look.name}`);
    zoomBtn.tabIndex = isOn ? 0 : -1;

    const pinsWrap = document.createElement('div');
    pinsWrap.className = 'rw__pins';

    for (const pin of look.pins) {
      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = 'rw__pin';
      pinBtn.setAttribute('data-rw-pin', String(pin.number));
      pinBtn.setAttribute('data-tip', pin.productName);
      pinBtn.style.left = pin.left;
      pinBtn.style.top = pin.top;
      pinBtn.style.setProperty('--pi', String(pin.number));
      pinBtn.setAttribute('aria-label', `${pin.number}: ${pin.productName}`);
      pinBtn.tabIndex = -1;

      const dot = document.createElement('span');
      dot.className = 'rw__pin-dot';
      dot.textContent = String(pin.number);
      pinBtn.appendChild(dot);
      pinsWrap.appendChild(pinBtn);
    }

    art.append(img, zoomBtn, pinsWrap);
    fig.appendChild(art);
    morph.append(shadow, fig);
    hero.appendChild(morph);
    return hero;
  }

  private createModelImg(look: NormalizedLook, loading: 'eager' | 'lazy'): HTMLImageElement {
    const img = document.createElement('img');
    img.src = look.image640;
    if (!look.image640.startsWith('data:')) {
      img.srcset = `${look.image640} 640w, ${look.image1080} 1080w`;
      img.sizes = '(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px';
    }
    img.loading = loading;
    img.decoding = 'async';
    img.width = 1100;
    img.height = 1956;
    img.draggable = false;
    img.setAttribute('data-model-image', '');
    img.alt = look.name;
    return img;
  }

  private createTickElement(look: NormalizedLook, isCurrent: boolean): HTMLButtonElement {
    const num = String(look.index + 1).padStart(2, '0');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rw__tick';
    btn.setAttribute('data-rw-tick', String(look.index));
    btn.setAttribute('aria-current', String(isCurrent));
    btn.setAttribute('aria-label', `Look ${look.index + 1}: ${look.name}`);

    const bar = document.createElement('span');
    bar.className = 'rw__tick-bar';

    const label = document.createElement('span');
    label.className = 'rw__tick-label';
    label.append(document.createTextNode(num));

    const nameSpan = document.createElement('span');
    nameSpan.className = 'rw__tick-name';
    nameSpan.innerHTML = `&nbsp;&nbsp;${this.escapeHtml(look.name)}`;
    label.appendChild(nameSpan);

    btn.append(bar, label);
    return btn;
  }

  private createPanelElement(look: NormalizedLook, isActive: boolean): HTMLElement {
    const panel = document.createElement('div');
    panel.className = `rw__look-panel${isActive ? ' is-in' : ''}`;
    panel.setAttribute('data-rw-panel', String(look.index));
    if (!isActive) panel.hidden = true;

    const mhead = document.createElement('div');
    mhead.className = 'rw__mhead';
    mhead.innerHTML = `
      <span class="rw__mhead-title">${this.escapeHtml(look.name)}</span>
      <span class="rw__label">${this.escapeHtml(look.piecesLabel)}</span>
    `;

    const list = document.createElement('ul');
    list.className = 'rw__items';
    list.setAttribute('role', 'list');

    if (look.isCustom && look.customOutfit) {
      for (const piece of look.pieces) {
        const li = document.createElement('li');
        li.className = 'rw__item rw__item--custom';
        li.setAttribute('data-rw-card', String(piece.number));
        li.style.setProperty('--i', String(piece.number));
        li.setAttribute('data-title', piece.customTitle || look.name);

        const media = document.createElement('div');
        media.className = 'rw__media';
        const img = document.createElement('img');
        img.src = piece.customImage || look.image640;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 400;
        img.height = 500;
        const numBadge = document.createElement('span');
        numBadge.className = 'rw__num';
        numBadge.textContent = String(piece.number);
        media.append(img, numBadge);

        const info = document.createElement('div');
        info.className = 'rw__info';
        const typeEl = document.createElement('span');
        typeEl.className = 'rw__type';
        typeEl.textContent = piece.customVendor || 'Virtual Closet';
        const nameEl = document.createElement('span');
        nameEl.className = 'rw__name';
        nameEl.textContent = piece.customTitle || look.name;
        const priceEl = document.createElement('span');
        priceEl.className = 'rw__price';
        priceEl.innerHTML = `<span>Piece 0${piece.number}</span>`;
        info.append(typeEl, nameEl, priceEl);

        const spacer = document.createElement('span');
        spacer.setAttribute('aria-hidden', 'true');

        li.append(media, info, spacer);
        list.appendChild(li);
      }

      const bundle = document.createElement('div');
      bundle.className = 'rw__bundle has-rule';
      bundle.innerHTML = `
        <div class="rw__bundle-row">
          <div class="rw__bundle-copy">
            <span class="rw__bundle-title">${this.escapeHtml(look.name)}</span>
            <span class="rw__bundle-note">${this.escapeHtml(look.description)}</span>
          </div>
        </div>
        <button type="button" class="rw__cta" data-rw-open-closet>
          <span class="rw__cta-add">Manage in Virtual Closet</span>
          <span class="rw__cta-m">Manage in Virtual Closet</span>
          <svg class="rw__cta-arrow" width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 7h24M19 1l6 6-6 6"/>
          </svg>
        </button>
      `;

      const tpl = document.createElement('template');
      tpl.setAttribute('data-rw-pieces-text', '');
      tpl.textContent = look.piecesLabel;

      panel.append(mhead, list, bundle, tpl);
      return panel;
    }

    for (const piece of look.pieces) {
      const item = piece.item;
      if (!item) continue;
      const n = piece.number;
      const pickerId = `Picker-template--28035983671601__the_runway_wdM8BG-look_${look.key}-${n}`;
      const radioName = `Opt-template--28035983671601__the_runway_wdM8BG-look_${look.key}-${n}-1`;

      const li = document.createElement('li');
      li.className = 'rw__item';
      li.setAttribute('data-rw-card', String(n));
      li.style.setProperty('--i', String(n));
      li.setAttribute('data-title', item.name);
      if (item.variants[0]) {
        li.dataset.selected = String(item.variants[0].id);
      }

      if (piece.tag) {
        const tag = document.createElement('span');
        tag.className = 'rw__tag';
        tag.innerHTML = `<span class="rw__tag-text">${this.escapeHtml(piece.tag)}</span>`;
        li.appendChild(tag);
      }

      const mediaLink = document.createElement('a');
      mediaLink.className = 'rw__media';
      mediaLink.href = item.url;
      mediaLink.target = '_blank';
      mediaLink.rel = 'noopener noreferrer';
      mediaLink.tabIndex = -1;
      mediaLink.setAttribute('aria-hidden', 'true');

      const thumb = document.createElement('img');
      thumb.src = item.image;
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
      thumb.width = item.width;
      thumb.height = item.height;

      const numBadge = document.createElement('span');
      numBadge.className = 'rw__num';
      numBadge.textContent = String(n);
      mediaLink.append(thumb, numBadge);

      const info = document.createElement('div');
      info.className = 'rw__info';

      const vendor = document.createElement('span');
      vendor.className = 'rw__type';
      vendor.textContent = item.vendor;

      const nameLink = document.createElement('a');
      nameLink.className = 'rw__name';
      nameLink.href = item.url;
      nameLink.target = '_blank';
      nameLink.rel = 'noopener noreferrer';
      nameLink.textContent = item.name;

      const price = document.createElement('span');
      price.className = 'rw__price';
      price.innerHTML = `<span>${formatMoney(item.price)}</span>`;

      info.append(vendor, nameLink, price);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'rw__add';
      addBtn.setAttribute('data-rw-add', '');
      addBtn.setAttribute('aria-expanded', 'false');
      addBtn.setAttribute('aria-controls', pickerId);
      addBtn.setAttribute('aria-label', `Add to bag: ${item.name}`);
      addBtn.setAttribute('data-added-label', `Added to bag: ${item.name}`);
      addBtn.innerHTML = `
        <svg class="rw__add-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">
          <path d="M12 4v16M4 12h16"/>
        </svg>
        <svg class="rw__add-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4.5 12.5l5 5L19.5 7"/>
        </svg>
        <svg class="rw__add-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 1-9 9"/>
        </svg>
      `;

      const picker = document.createElement('div');
      picker.className = 'rw__picker';
      picker.id = pickerId;
      picker.setAttribute('data-rw-picker', '');
      picker.hidden = true;

      const pillsHtml = item.sizes
        .map(
          (val, idx) => `
          <label class="rw__pill">
            <input type="radio" name="${this.escapeHtml(radioName)}" value="${this.escapeHtml(val)}" data-rw-option="0"${idx === 0 ? ' checked' : ''}>
            <span class="rw__pill-label">${this.escapeHtml(val)}</span>
          </label>
        `
        )
        .join('');

      picker.innerHTML = `
        <div class="rw__picker-head">
          <img class="rw__picker-thumb" src="${this.escapeHtml(item.image)}" alt="" width="160" height="${item.sheetHeight}" loading="lazy" decoding="async">
          <div class="rw__picker-meta">
            <span class="rw__picker-title">${this.escapeHtml(item.name)}</span>
            <span class="rw__picker-price">${formatMoney(item.price)}</span>
          </div>
          <button type="button" class="rw__pick-close" data-rw-pick-close aria-label="Close size picker">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19"/>
            </svg>
          </button>
        </div>
        <fieldset class="rw__opt">
          <legend class="rw__opt-name">${this.escapeHtml(item.optionName)}</legend>
          <div class="rw__pills">${pillsHtml}</div>
        </fieldset>
        <script type="application/json" data-rw-variants>${JSON.stringify(item.variants)}</script>
        <button type="button" class="rw__confirm" data-rw-confirm>
          <span data-rw-confirm-label data-add="Add to bag">Add to bag</span>
          <span class="rw__sr"> — ${this.escapeHtml(item.name)}</span>
        </button>
      `;

      li.append(mediaLink, info, addBtn, picker);
      list.appendChild(li);
    }

    const rawTotal = look.pieces.reduce((sum, p) => sum + (p.item?.price ?? 0), 0);
    const bundleTotal = Math.round(rawTotal * 0.9);

    const bundle = document.createElement('div');
    bundle.className = 'rw__bundle has-rule';
    bundle.innerHTML = `
      <p class="rw__msg" data-rw-msg role="status" aria-live="polite" hidden></p>
      <div class="rw__bundle-row">
        <div class="rw__bundle-copy">
          <span class="rw__bundle-title">Complete the look</span>
          <span class="rw__bundle-note">Bundle all ${look.pieces.length} and save 10%</span>
        </div>
        <div class="rw__bundle-price">
          <s>${formatMoney(rawTotal)}</s>
          <strong>${formatMoney(bundleTotal)}</strong>
        </div>
      </div>
      <button type="button" class="rw__cta" data-rw-all>
        <span class="rw__cta-add">Add full look to bag</span>
        <span class="rw__cta-m">Add full look — ${formatMoney(bundleTotal)}</span>
        <span class="rw__cta-done">Full look in your bag</span>
        <svg class="rw__cta-arrow" width="22" height="12" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1 7h24M19 1l6 6-6 6"/>
        </svg>
        <svg class="rw__cta-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 1-9 9"/>
        </svg>
      </button>
    `;

    const tpl = document.createElement('template');
    tpl.setAttribute('data-rw-pieces-text', '');
    tpl.textContent = look.piecesLabel;

    panel.append(mhead, list, bundle, tpl);
    return panel;
  }

  private bindEvents(): void {
    const onResize = () => {
      if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        this.measure();
        this.renderAll();
      }, 120);
    };
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));

    const onVisibility = () => {
      if (!document.hidden && this.visible) {
        this.lastFrameTime = 0;
        this.kick();
        this.scheduleAutoplay();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

    const onStagePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.dragPointerId = e.pointerId;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartTarget = this.target;
      this.dragAbandoned = false;
      this.dragSamples = [{ x: e.clientX, time: performance.now() }];
    };

    const onStagePointerMove = (e: PointerEvent) => {
      if (this.canHoverCursor && e.pointerType === 'mouse') {
        const rect = this.stageEl.getBoundingClientRect();
        this.cursorTargetX = e.clientX - rect.left;
        this.cursorTargetY = e.clientY - rect.top;
        if (!this.cursorEntered) {
          this.cursorEntered = true;
          this.cursorX = this.cursorTargetX;
          this.cursorY = this.cursorTargetY;
          this.cursorEl?.classList.add('is-on');
        }
        this.updateCursorHoverState(e.target as HTMLElement | null);
        this.kickCursor();
      }

      if (this.dragPointerId !== e.pointerId || this.dragAbandoned) return;
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        this.finishDrag(e);
        return;
      }

      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (!this.dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          this.dragAbandoned = true;
          this.dragPointerId = null;
          return;
        }
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
          this.dragging = true;
          this.classList.add('is-dragging');
          this.setStill(false);
          try {
            this.stageEl.setPointerCapture(e.pointerId);
          } catch {
            // Ignore capture errors
          }
        } else {
          return;
        }
      }

      const now = performance.now();
      this.dragSamples.push({ x: e.clientX, time: now });
      if (this.dragSamples.length > 6) this.dragSamples.shift();

      this.target = this.dragStartTarget - dx / this.unit;
      this.kick();
    };

    const onStagePointerUp = (e: PointerEvent) => {
      if (this.dragPointerId !== e.pointerId) return;
      this.finishDrag(e);
    };

    const onStagePointerLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        this.cursorEntered = false;
        this.cursorEl?.classList.remove('is-on', 'is-link', 'is-view');
      }
    };

    this.stageEl.addEventListener('pointerdown', onStagePointerDown);
    this.stageEl.addEventListener('pointermove', onStagePointerMove);
    this.stageEl.addEventListener('pointerup', onStagePointerUp);
    this.stageEl.addEventListener('pointercancel', onStagePointerUp);
    this.stageEl.addEventListener('pointerleave', onStagePointerLeave);

    const onCaptureClick = (e: MouseEvent) => {
      if (performance.now() < this.suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    this.stageEl.addEventListener('click', onCaptureClick, true);

    const onStageWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      if (now < this.wheelLockedUntil) return;
      this.wheelAcc += e.deltaX;
      if (Math.abs(this.wheelAcc) > 45) {
        if (this.wheelAcc > 0) this.next();
        else this.prev();
        this.wheelAcc = 0;
        this.wheelLockedUntil = now + 520;
      }
    };
    this.stageEl.addEventListener('wheel', onStageWheel, { passive: false });

    const onStageKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prev();
      }
    };
    this.stageEl.addEventListener('keydown', onStageKeyDown);

    const onSectionKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.openSheetCard) {
          e.preventDefault();
          const addBtn = this.openSheetCard.querySelector<HTMLButtonElement>('[data-rw-add]');
          this.closeSheet(true);
          addBtn?.focus();
        } else if (this.zoomed) {
          e.preventDefault();
          this.closeLightbox(false);
        }
      }
    };
    this.addEventListener('keydown', onSectionKeyDown);

    const onSectionClick = (e: MouseEvent) => {
      this.routeClick(e.target as HTMLElement | null);
    };
    this.addEventListener('click', onSectionClick);

    const onSectionChange = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      if (!target || !target.matches('[data-rw-option]')) return;
      this.engage();
      const card = target.closest<HTMLElement>('[data-rw-card]') || this.openSheetCard;
      const picker = target.closest<HTMLElement>('[data-rw-picker]');
      if (card && picker) {
        this.handleOptionChange(card, picker, true);
      }
    };
    this.addEventListener('change', onSectionChange);

    const onPanelPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        this.panelHover = true;
      }
    };
    const onPanelPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        this.panelHover = false;
        this.restartAutoplayBar();
      }
    };
    const onPanelPointerOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-rw-card]');
      if (card) {
        const n = Number(card.dataset.rwCard);
        if (n) this.hot(n, false);
      }
    };
    const onPanelPointerOut = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const fromCard = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-rw-card]');
      const toCard = (e.relatedTarget as HTMLElement | null)?.closest<HTMLElement>('[data-rw-card]');
      if (fromCard && fromCard !== toCard) {
        this.clearHot();
      }
    };

    this.panelEl.addEventListener('pointerenter', onPanelPointerEnter);
    this.panelEl.addEventListener('pointerleave', onPanelPointerLeave);
    this.panelEl.addEventListener('pointerover', onPanelPointerOver);
    this.panelEl.addEventListener('pointerout', onPanelPointerOut);
  }

  private setupObservers(): void {
    this.visObserver = new IntersectionObserver(
      (entries) => {
        this.visible = entries.some((entry) => entry.isIntersecting);
        if (this.visible) {
          this.lastFrameTime = 0;
          this.kick();
          this.scheduleAutoplay();
        }
      },
      { threshold: 0 }
    );
    this.visObserver.observe(this);

    if (!this.reducedMotion) {
      this.revealObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                this.classList.add('is-revealed');
              });
            });
            this.revealObserver?.disconnect();
          }
        },
        { threshold: 0, rootMargin: '0px 0px -22% 0px' }
      );
      this.revealObserver.observe(this);
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.stageResizeObserver = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        const w = Math.round(rect?.width ?? 0);
        const h = Math.round(rect?.height ?? 0);
        if (
          Math.abs(w - this.lastObservedStageW) < 1 &&
          Math.abs(h - this.lastObservedStageH) < 1
        ) {
          return;
        }
        this.lastObservedStageW = w;
        this.lastObservedStageH = h;
        this.measure();
        this.renderAll();
      });
      this.stageResizeObserver.observe(this.stageEl);
    }
  }

  private finishDrag(e: PointerEvent): void {
    const wasDragging = this.dragging;
    this.dragging = false;
    this.dragPointerId = null;
    this.classList.remove('is-dragging');
    try {
      if (this.stageEl.hasPointerCapture(e.pointerId)) {
        this.stageEl.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (!wasDragging) return;
    this.suppressClickUntil = performance.now() + 60;

    const first = this.dragSamples[0];
    const last = this.dragSamples[this.dragSamples.length - 1];
    const dt = first && last ? Math.max(1, last.time - first.time) : 16;
    const vx = first && last ? (last.x - first.x) / dt : 0;
    const dx = e.clientX - this.dragStartX;
    const from = Math.round(this.dragStartTarget);

    if (this.isMobile) {
      if (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) {
        const step = dx > 0 ? -1 : 1;
        this.moveTo(from + step);
      } else {
        this.moveTo(from);
      }
    } else {
      let dest = Math.round(this.target - (vx * 160) / this.unit);
      if (dest === from && Math.abs(vx) > 0.3) {
        dest = from + (vx < 0 ? 1 : -1);
      }
      dest = clamp(dest, from - 2, from + 2);
      this.moveTo(dest);
    }
  }

  private routeClick(target: HTMLElement | null): void {
    if (!target) return;

    if (target.closest('[data-rw-pick-close]') || target.closest('.rw__pick-scrim')) {
      const card = this.openSheetCard || target.closest<HTMLElement>('[data-rw-card]');
      const addBtn = card?.querySelector<HTMLButtonElement>('[data-rw-add]');
      this.closePickerOrSheet(card);
      addBtn?.focus();
      return;
    }

    if (target.closest('[data-rw-zoom-close]')) {
      this.closeLightbox(false);
      return;
    }

    if (this.zoomed && (target === this.lbEl || target === this.lbStageEl)) {
      this.closeLightbox(false);
      return;
    }

    if (target.closest('[data-rw-zoom]')) {
      this.openLightbox();
      return;
    }

    if (target.closest('[data-rw-next]')) {
      this.next();
      return;
    }

    if (target.closest('[data-rw-prev]')) {
      this.prev();
      return;
    }

    const tickBtn = target.closest<HTMLButtonElement>('[data-rw-tick]');
    if (tickBtn) {
      const idx = Number(tickBtn.dataset.rwTick);
      if (Number.isInteger(idx)) this.go(idx);
      return;
    }

    if (target.closest('[data-rw-auto]')) {
      if (!this.playing) this.engaged = false;
      this.play(!this.playing);
      return;
    }

    const pinBtn = target.closest<HTMLButtonElement>('[data-rw-pin]');
    if (pinBtn) {
      this.engage();
      const n = Number(pinBtn.dataset.rwPin);
      if (n) this.hot(n, true);
      return;
    }

    const goBtn = target.closest<HTMLButtonElement>('[data-rw-go]');
    if (goBtn) {
      const bodyEl = goBtn.closest<HTMLElement>('[data-rw-model]');
      const bodyIndex = this.bodies.findIndex((b) => b.el === bodyEl);
      if (bodyIndex >= 0) {
        const k = this.computeSignedBodyRank(bodyIndex);
        if (k === 0) {
          this.openLightbox();
        } else if (Math.abs(k) < 6) {
          this.moveTo(Math.round(this.target) + k);
        }
      }
      return;
    }

    const confirmBtn = target.closest<HTMLButtonElement>('[data-rw-confirm]');
    if (confirmBtn) {
      this.engage();
      const picker = confirmBtn.closest<HTMLElement>('[data-rw-picker]');
      const card =
        confirmBtn.closest<HTMLElement>('[data-rw-card]') || this.openSheetCard;
      if (card && picker) {
        this.confirmSingleAdd(card, picker);
      }
      return;
    }

    const addBtn = target.closest<HTMLButtonElement>('[data-rw-add]');
    if (addBtn) {
      this.engage();
      const card = addBtn.closest<HTMLElement>('[data-rw-card]');
      if (card && !card.classList.contains('is-added') && !card.classList.contains('is-loading')) {
        this.togglePicker(card);
      }
      return;
    }

    const allBtn = target.closest<HTMLButtonElement>('[data-rw-all]');
    if (allBtn) {
      this.engage();
      const panel = allBtn.closest<HTMLElement>('[data-rw-panel]');
      if (panel) {
        this.addFullLook(panel, allBtn);
      }
      return;
    }

    if (target.closest('[data-rw-open-closet]')) {
      this.onOpenCloset?.();
    }
  }

  private measure(): void {
    const prevMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 749;
    this.mode = this.isMobile ? 'classic' : 'ring';

    if (prevMobile && !this.isMobile && this.openSheetCard) {
      this.closeSheet(true);
    }

    if (
      this.latchedVh === 0 ||
      this.latchedVw !== window.innerWidth ||
      Math.abs(window.innerHeight - this.latchedVh) >= 160
    ) {
      this.latchedVh = window.innerHeight;
      this.latchedVw = window.innerWidth;
    }

    const headerHeight = this.measureHeaderHeight();
    const frameH = computeFrameHeight({
      isMobile: this.isMobile,
      innerHeight: this.isMobile ? this.latchedVh : window.innerHeight,
      headerHeight,
      mobileHeightVh: Number(this.dataset.mheightVh || 109),
    });
    this.style.setProperty('--rw-frame-h', `${frameH}px`);

    const rect = this.stageEl.getBoundingClientRect();
    this.W = Math.max(200, rect.width || window.innerWidth);
    this.H = Math.max(200, rect.height || frameH);

    this.fs = this.mode === 'ring' ? 1.08 : 1;
    this.style.setProperty('--rw-fs', String(this.fs));

    const modelH = computeModelHeight(this.H, this.mode, this.isMobile);
    this.stageEl.style.setProperty('--rw-model-h', `${modelH}px`);

    const hx = this.mode === 'ring' ? 0.5 * this.W : this.isMobile ? 0.3 * this.W : 0.4 * this.W;
    const hy = this.mode === 'ring' ? 34 : this.isMobile ? 22 : 36;
    this.stageEl.style.setProperty('--rw-hx', `${hx}px`);
    this.stageEl.style.setProperty('--rw-hy', `${hy}px`);
    this.style.setProperty('--rw-ax', `${((hx / this.W) * 100).toFixed(2)}%`);

    this.unit =
      this.mode === 'ring'
        ? Math.max(this.isMobile ? 90 : 120, 0.3 * this.W)
        : Math.max(90, this.W * 0.32 * 1.6);

    for (const body of this.bodies) {
      const fig = body.el.querySelector<HTMLElement>('.rw__figure');
      body.w = fig?.offsetWidth || modelH * 0.5625;
    }

    if (this.zoomed) {
      this.sizeLightboxModel();
    }
  }

  private measureHeaderHeight(): number {
    let total = 0;
    const selectors =
      '.shopify-section-group-header-group, #shopify-section-header, #shopify-section-announcement-bar';
    document.querySelectorAll<HTMLElement>(selectors).forEach((el) => {
      if (el.contains(this)) return;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      total += el.getBoundingClientRect().height;
    });
    return total || (this.isMobile ? 68 : 88);
  }

  private setStill(value: boolean): void {
    if (this.still === value) return;
    this.still = value;
    this.classList.toggle('rw--still', value);
  }

  private kick(resetTime = true): void {
    if (this.rafId !== null || document.hidden || !this.visible) return;
    if (resetTime) this.lastFrameTime = 0;
    this.rafId = requestAnimationFrame((now) => this.tickLoop(now));
  }

  private tickLoop(now: number): void {
    this.rafId = null;
    if (document.hidden || !this.visible) return;

    const dt =
      this.lastFrameTime === 0
        ? 1 / 60
        : Math.min(0.034, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (this.reducedMotion) {
      this.cur = this.target;
      this.vel = 0;
      for (const body of this.bodies) {
        const goal = wrapMod(this.bodies.indexOf(body) - this.target, this.bodies.length);
        body.x = goal;
        body.g = goal;
        body.goal = goal;
        body.v = 0;
        body.trip = false;
      }
      this.setStill(true);
      this.renderAll();
      return;
    }

    let allSettled = true;

    if (this.mode === 'ring') {
      if (this.dragging) {
        this.cur = this.target;
        this.vel = 0;
        allSettled = false;
      } else {
        const res = stepSpring(this.cur, this.vel, this.target, dt, K_SPRING, C_SPRING, 0.0005);
        this.cur = res.cur;
        this.vel = res.vel;
        allSettled = res.settled;
      }
    } else {
      const N = this.bodies.length;
      if (this.dragging) {
        this.cur = this.target;
      } else {
        const res = stepSpring(this.cur, this.vel, this.target, dt, K_SPRING, C_SPRING, 0.0005);
        this.cur = res.cur;
        this.vel = res.vel;
        if (!res.settled) allSettled = false;
      }

      for (let a = 0; a < N; a++) {
        const body = this.bodies[a];
        const goal = wrapMod(a - this.target, N);
        if (Math.abs(goal - body.goal) > N / 2) {
          body.trip = true;
          body.from = body.x;
        }
        body.goal = goal;

        const tau = this.dragging
          ? 0.016
          : body.trip
            ? 0.1
            : 0.03 + 0.04 * Math.min(goal, 4);
        body.g += (goal - body.g) * (1 - Math.exp(-dt / tau));

        const bRes = stepSpring(body.x, body.v, body.g, dt, K_SPRING, C_SPRING, 0.0006);
        body.x = bRes.cur;
        body.v = bRes.vel;
        if (body.trip && Math.abs(body.x - goal) < 0.02) {
          body.trip = false;
        }
        if (!bRes.settled || Math.abs(body.g - goal) > 0.001) {
          allSettled = false;
        }
      }
    }

    if (this.dragging || !allSettled) {
      this.setStill(false);
      this.renderAll();
      this.kick(false);
    } else {
      this.setStill(true);
      this.renderAll();
    }
  }

  private renderAll(): void {
    const N = this.bodies.length;
    const blurEnabled = this.dataset.blur !== 'false';

    if (this.mode === 'ring') {
      for (let a = 0; a < N; a++) {
        const body = this.bodies[a];
        const pose = computeRingSlotPose({
          bodyIndex: a,
          bodyCount: N,
          cur: this.cur,
          W: this.W,
          H: this.H,
          fs: this.fs,
          isMobile: this.isMobile,
          isStill: this.still,
          blurEnabled,
        });
        this.putBody(body, pose.x, pose.bottom, pose.scale, pose.opacity, pose.blur, pose.z);
      }
      return;
    }

    for (let a = 0; a < N; a++) {
      const body = this.bodies[a];
      let k = body.x;
      let exitE = -1;

      if (body.trip) {
        const span = Math.abs(body.goal - body.from) || 1;
        const u = clamp(Math.abs(body.x - body.from) / span, 0, 1);
        if (body.goal > body.from) {
          if (u < 0.5) {
            exitE = 2 * u * 1.4;
          } else {
            k = body.goal + 2 * (1 - u);
          }
        } else {
          if (u < 0.5) {
            k = body.from + 2 * u;
          } else {
            exitE = 2 * (1 - u) * 1.4;
          }
        }
      } else if (k < 0) {
        exitE = Math.min(-k, 1.4);
      }

      const pose = computeClassicSlotPose({
        k,
        exitE,
        W: this.W,
        isMobile: this.isMobile,
        isStill: this.still,
        blurEnabled,
      });
      this.putBody(body, pose.x, pose.bottom, pose.scale, pose.opacity, pose.blur, pose.z);
    }
  }

  private putBody(
    body: BodyState,
    x: number,
    bottom: number,
    scale: number,
    opacity: number,
    blur: number,
    z: number
  ): void {
    let op = opacity;
    const halfW = (body.w * scale) / 2;
    if (x + halfW < -4 || x - halfW > this.W + 4) {
      op = 0;
    }

    body.el.style.transform = `translate3d(${x.toFixed(2)}px, ${(-bottom).toFixed(2)}px, 0) translateX(-50%) scale(${scale.toFixed(4)})`;
    body.el.style.opacity = op.toFixed(3);
    body.el.style.zIndex = String(z);
    body.el.style.visibility = op < 0.01 ? 'hidden' : 'visible';
    body.el.style.pointerEvents = op < 0.5 ? 'none' : 'auto';

    const bRound = op < 0.01 ? 0 : Math.round(blur * 10) / 10;
    if (bRound !== body.lastBlur) {
      body.lastBlur = bRound;
      body.el.style.filter = bRound <= 0.05 ? '' : `blur(${bRound}px)`;
    }
  }

  private computeSignedBodyRank(bodyIndex: number): number {
    const N = this.bodies.length;
    const step = (Math.PI * 2) / Math.max(1, N);
    const phi = ((bodyIndex - this.cur) * step) % (Math.PI * 2);
    const wrapped = phi > Math.PI ? phi - Math.PI * 2 : phi < -Math.PI ? phi + Math.PI * 2 : phi;
    return Math.round(wrapped / step);
  }

  private setIndex(nextIndex: number, silent = false): void {
    const count = this.looks.length;
    const prevIndex = this.index;
    this.index = wrapMod(nextIndex, count);

    for (let a = 0; a < this.bodies.length; a++) {
      const body = this.bodies[a];
      const rank =
        this.mode === 'ring'
          ? this.computeSignedBodyRank(a)
          : wrapMod(a - Math.round(this.target), this.bodies.length);
      const accessible =
        this.mode === 'ring'
          ? rank !== 0 && Math.abs(rank) <= 2
          : rank !== 0 && rank <= 3;

      if (body.hit) {
        body.hit.tabIndex = accessible ? 0 : -1;
      }
      body.el.setAttribute('aria-hidden', String(!accessible));
    }

    this.style.setProperty('--rw-progress', ((this.index + 1) / count).toFixed(3));

    this.ticks.forEach((tick, j) => {
      tick.setAttribute('aria-current', String(j === this.index));
      tick.classList.toggle('is-past', j < this.index);
    });

    if (silent) {
      this.heroes.forEach((hero, j) => {
        const isOn = j === this.index;
        hero.classList.toggle('is-on', isOn);
        hero.classList.remove('was');
        hero.setAttribute('aria-hidden', String(!isOn));
        const zBtn = hero.querySelector<HTMLButtonElement>('[data-rw-zoom]');
        if (zBtn) zBtn.tabIndex = isOn ? 0 : -1;
      });
      this.panels.forEach((panel, j) => {
        panel.hidden = j !== this.index;
        panel.classList.toggle('is-in', j === this.index);
      });
      const tpl = this.panels[this.index]?.querySelector<HTMLTemplateElement>('[data-rw-pieces-text]');
      this.piecesLabelEl.textContent = tpl?.textContent || this.looks[this.index]?.piecesLabel || '';
      this.restartAutoplayBar();
      return;
    }

    if (this.zoomed) this.closeLightbox(true);
    if (this.openSheetCard) this.closeSheet(true);

    this.heroes.forEach((hero, j) => {
      const isOn = j === this.index;
      hero.classList.toggle('is-on', isOn);
      hero.classList.toggle('was', j === prevIndex && j !== this.index);
      hero.setAttribute('aria-hidden', String(!isOn));
      const zBtn = hero.querySelector<HTMLButtonElement>('[data-rw-zoom]');
      if (zBtn) zBtn.tabIndex = isOn ? 0 : -1;
    });

    this.triggerSweep();

    const activeLook = this.looks[this.index];
    if (activeLook) {
      this.liveEl.textContent = `Look ${this.index + 1}: ${activeLook.name}`;
    }

    this.panels.forEach((panel, j) => {
      panel.hidden = j !== this.index;
      panel.classList.remove('is-in');
    });
    const nextPanel = this.panels[this.index];
    if (nextPanel) {
      void nextPanel.offsetWidth;
      nextPanel.classList.add('is-in');
      const tpl = nextPanel.querySelector<HTMLTemplateElement>('[data-rw-pieces-text]');
      this.piecesLabelEl.textContent = tpl?.textContent || activeLook?.piecesLabel || '';
      this.piecesLabelEl.classList.remove('is-swap');
      void this.piecesLabelEl.offsetWidth;
      this.piecesLabelEl.classList.add('is-swap');
    }

    this.clearHot();
    this.restartAutoplayBar();
  }

  private next(): void {
    this.moveTo(Math.round(this.target) + 1);
  }

  private prev(): void {
    this.moveTo(Math.round(this.target) - 1);
  }

  private go(targetIdx: number): void {
    const d = shortestLoopDelta(this.index, targetIdx, this.looks.length);
    this.moveTo(Math.round(this.target) + d);
  }

  private moveTo(T: number): void {
    this.target = T;
    this.setStill(false);
    this.setIndex(wrapMod(T, this.looks.length), false);
    this.kick();
  }

  private play(state: boolean): void {
    this.playing = state;
    this.classList.toggle('is-playing', state);
    this.autoBtn.setAttribute('aria-pressed', String(state));
    this.restartAutoplayBar();
    this.scheduleAutoplay();
  }

  private engage(): void {
    if (this.engaged) return;
    this.engaged = true;
    this.play(false);
  }

  private restartAutoplayBar(): void {
    for (const tick of this.ticks) {
      tick.classList.remove('is-run');
    }
    if (!this.playing) return;
    const activeTick = this.ticks[this.index];
    if (activeTick) {
      void activeTick.offsetWidth;
      activeTick.classList.add('is-run');
    }
  }

  private scheduleAutoplay(): void {
    if (this.autoTimer !== null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    if (!this.playing) return;
    const speed = Number(this.dataset.speed || 5000);
    this.autoTimer = window.setTimeout(() => {
      if (
        this.playing &&
        this.visible &&
        !this.dragging &&
        !document.hidden &&
        !this.panelHover &&
        !this.zoomed &&
        !this.engaged
      ) {
        this.next();
      } else {
        this.restartAutoplayBar();
        this.scheduleAutoplay();
      }
    }, speed);
  }

  private triggerSweep(): void {
    if (this.reducedMotion) return;
    this.stageEl.classList.remove('is-sweep');
    void this.stageEl.offsetWidth;
    this.stageEl.classList.add('is-sweep');
  }

  private hot(n: number, scroll: boolean): void {
    this.clearHot();
    const pinScope = this.zoomed ? this.lbStageEl : this.heroes[this.index];
    pinScope?.querySelector(`[data-rw-pin="${n}"]`)?.classList.add('is-hot');
    const activePanel = this.panels[this.index];
    const card = activePanel?.querySelector<HTMLElement>(`[data-rw-card="${n}"]`);
    if (card) {
      card.classList.add('is-hot');
      if (scroll) {
        this.revealCard(card);
      }
    }
  }

  private clearHot(): void {
    this.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
  }

  private revealCard(card: HTMLElement): void {
    const list = card.closest<HTMLElement>('.rw__items');
    if (!list) return;
    const behavior: ScrollBehavior = this.reducedMotion ? 'auto' : 'smooth';

    if (list.scrollWidth > list.clientWidth + 4) {
      const targetLeft =
        card.getBoundingClientRect().left -
        list.getBoundingClientRect().left +
        list.scrollLeft -
        20;
      list.scrollTo({ left: Math.max(0, targetLeft), behavior });
    } else if (list.scrollHeight > list.clientHeight + 4) {
      list.scrollTo({ top: Math.max(0, card.offsetTop - list.offsetTop - 12), behavior });
    } else {
      const r = card.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight - 140) {
        window.scrollBy({
          top: r.top - 0.3 * window.innerHeight,
          behavior,
        });
      }
    }
  }

  private togglePicker(card: HTMLElement): void {
    const picker =
      card.querySelector<HTMLElement>('[data-rw-picker]') ||
      (this.openSheetCard === card
        ? this.sheetHost?.querySelector<HTMLElement>('[data-rw-picker]') ?? null
        : null);
    if (!picker) return;

    if (this.isMobile) {
      if (this.openSheetCard === card) {
        this.closeSheet(false);
      } else {
        this.openSheet(card, picker);
      }
      return;
    }

    const isOpen = !picker.hidden;
    if (isOpen) {
      this.closeInlinePicker(card, picker);
    } else {
      this.openInlinePicker(card, picker);
    }
  }

  private openInlinePicker(card: HTMLElement, picker: HTMLElement): void {
    picker.hidden = false;
    card.classList.add('is-picking');
    const addBtn = card.querySelector<HTMLButtonElement>('[data-rw-add]');
    addBtn?.setAttribute('aria-expanded', 'true');
    this.revealCard(card);
    const checked = picker.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    checked?.focus({ preventScroll: true });
  }

  private closeInlinePicker(card: HTMLElement, picker: HTMLElement): void {
    picker.hidden = true;
    card.classList.remove('is-picking');
    const addBtn = card.querySelector<HTMLButtonElement>('[data-rw-add]');
    addBtn?.setAttribute('aria-expanded', 'false');
  }

  private closePickerOrSheet(card: HTMLElement | null): void {
    if (!card) return;
    if (this.openSheetCard === card) {
      this.closeSheet(false);
      return;
    }
    const picker = card.querySelector<HTMLElement>('[data-rw-picker]');
    if (picker && !picker.hidden) {
      this.closeInlinePicker(card, picker);
    }
  }

  private ensureSheetHost(): HTMLDivElement {
    if (this.sheetHost) return this.sheetHost;
    const host = document.createElement('div');
    host.className = 'rw-sheet-host';

    const scrim = document.createElement('button');
    scrim.type = 'button';
    scrim.className = 'rw__pick-scrim';
    scrim.setAttribute('data-rw-pick-close', '');
    scrim.tabIndex = -1;
    scrim.setAttribute('aria-hidden', 'true');
    host.appendChild(scrim);

    host.addEventListener('click', (e) => {
      this.routeClick(e.target as HTMLElement | null);
    });
    host.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement | null;
      if (!target || !target.matches('[data-rw-option]')) return;
      this.engage();
      if (this.openSheetCard) {
        const picker = host.querySelector<HTMLElement>('[data-rw-picker]');
        if (picker) this.handleOptionChange(this.openSheetCard, picker, true);
      }
    });
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.openSheetCard) {
        e.preventDefault();
        const addBtn = this.openSheetCard.querySelector<HTMLButtonElement>('[data-rw-add]');
        this.closeSheet(true);
        addBtn?.focus();
      }
    });

    document.body.appendChild(host);
    this.sheetHost = host;
    return host;
  }

  private openSheet(card: HTMLElement, picker: HTMLElement): void {
    if (this.openSheetCard && this.openSheetCard !== card) {
      this.closeSheet(true);
    }

    const host = this.ensureSheetHost();
    const cs = window.getComputedStyle(this);
    for (const prop of PICKER_STYLE_PROPS) {
      host.style.setProperty(prop, cs.getPropertyValue(prop));
    }
    host.style.fontFamily = cs.fontFamily;
    host.style.color = cs.color;

    this.openSheetOriginPickerParent = card;
    this.openSheetCard = card;
    picker.hidden = false;
    host.appendChild(picker);

    card.classList.add('is-picking');
    card.querySelector('[data-rw-add]')?.setAttribute('aria-expanded', 'true');
    this.classList.add('rw--picking');

    requestAnimationFrame(() => {
      host.classList.add('is-open');
      const checked = picker.querySelector<HTMLInputElement>('input[type="radio"]:checked');
      checked?.focus({ preventScroll: true });
    });
  }

  private closeSheet(immediate: boolean): void {
    if (!this.openSheetCard || !this.sheetHost) return;
    const card = this.openSheetCard;
    const picker = this.sheetHost.querySelector<HTMLElement>('[data-rw-picker]');
    const host = this.sheetHost;

    host.classList.remove('is-open');
    card.classList.remove('is-picking');
    card.querySelector('[data-rw-add]')?.setAttribute('aria-expanded', 'false');
    this.classList.remove('rw--picking');

    if (picker && this.openSheetOriginPickerParent) {
      picker.hidden = true;
      this.openSheetOriginPickerParent.appendChild(picker);
    }

    this.openSheetCard = null;
    this.openSheetOriginPickerParent = null;
    if (immediate) {
      host.classList.remove('is-open');
    }
  }

  private handleOptionChange(card: HTMLElement, picker: HTMLElement, touched: boolean): void {
    const checked = picker.querySelector<HTMLInputElement>('input[data-rw-option="0"]:checked');
    const selectedVal = checked?.value || '';
    const jsonEl = picker.querySelector<HTMLScriptElement>('script[data-rw-variants]');
    const variants: Array<{ id: number; a: boolean; o: string[] }> = jsonEl
      ? JSON.parse(jsonEl.textContent || '[]')
      : [];

    const match = variants.find((v) => v.o[0] === selectedVal && v.a);
    const anyMatch = variants.find((v) => v.o[0] === selectedVal);

    picker.querySelectorAll<HTMLInputElement>('input[data-rw-option="0"]').forEach((input) => {
      const avail = variants.some((v) => v.o[0] === input.value && v.a);
      input.closest('.rw__pill')?.classList.toggle('is-unavailable', !avail);
    });

    const confirmBtn = picker.querySelector<HTMLButtonElement>('[data-rw-confirm]');
    const confirmLabel = picker.querySelector<HTMLElement>('[data-rw-confirm-label]');
    if (confirmBtn && confirmLabel) {
      if (match) {
        confirmBtn.disabled = false;
        confirmLabel.textContent = confirmLabel.dataset.add || 'Add to bag';
      } else {
        confirmBtn.disabled = true;
        confirmLabel.textContent = this.dataset.msgSoldout || 'Sold out';
      }
    }

    if (anyMatch) {
      card.dataset.selected = String(anyMatch.id);
    } else {
      delete card.dataset.selected;
    }

    if (touched) {
      card.dataset.touched = '1';
    }
  }

  private confirmSingleAdd(card: HTMLElement, picker: HTMLElement): void {
    this.handleOptionChange(card, picker, true);
    const variantId = Number(card.dataset.selected);
    const panel = card.closest<HTMLElement>('[data-rw-panel]');
    const msgEl = panel?.querySelector<HTMLElement>('[data-rw-msg]');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.hidden = true;
    }

    if (!Number.isSafeInteger(variantId)) {
      if (msgEl) {
        msgEl.textContent = this.dataset.msgError || 'Couldn’t add to bag. Please try again.';
        msgEl.hidden = false;
      }
      return;
    }

    card.classList.add('is-loading');
    try {
      this.bagAdder?.([{ id: variantId, quantity: 1 }]);
      card.classList.remove('is-loading');
      this.markCardAdded(card);
      this.closePickerOrSheet(card);
      if (panel) this.checkPanelComplete(panel);
    } catch {
      card.classList.remove('is-loading');
      if (msgEl) {
        msgEl.textContent = this.dataset.msgError || 'Couldn’t add to bag. Please try again.';
        msgEl.hidden = false;
      }
    }
  }

  private addFullLook(panel: HTMLElement, ctaBtn: HTMLButtonElement): void {
    if (panel.classList.contains('is-complete') || ctaBtn.classList.contains('is-loading')) {
      return;
    }

    const msgEl = panel.querySelector<HTMLElement>('[data-rw-msg]');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.hidden = true;
    }

    const cards = Array.from(panel.querySelectorAll<HTMLElement>('[data-rw-card]')).filter(
      (c) => !c.classList.contains('is-added')
    );

    const ready: Array<{ card: HTMLElement; id: number }> = [];
    const pending: HTMLElement[] = [];

    for (const card of cards) {
      const selectedId = Number(card.dataset.selected);
      if (card.dataset.touched === '1' && Number.isSafeInteger(selectedId)) {
        ready.push({ card, id: selectedId });
      } else {
        pending.push(card);
      }
    }

    if (ready.length > 0) {
      ctaBtn.classList.add('is-loading');
      ready.forEach((r) => r.card.classList.add('is-loading'));
      try {
        this.bagAdder?.(ready.map((r) => ({ id: r.id, quantity: 1 })));
        ready.forEach((r) => {
          r.card.classList.remove('is-loading');
          this.markCardAdded(r.card);
          this.closePickerOrSheet(r.card);
        });
      } catch {
        ready.forEach((r) => r.card.classList.remove('is-loading'));
        if (msgEl) {
          msgEl.textContent = this.dataset.msgError || 'Couldn’t add to bag. Please try again.';
          msgEl.hidden = false;
        }
      } finally {
        ctaBtn.classList.remove('is-loading');
      }
    }

    if (pending.length > 0) {
      if (this.isMobile) {
        const firstPicker = pending[0].querySelector<HTMLElement>('[data-rw-picker]');
        if (firstPicker) this.openSheet(pending[0], firstPicker);
      } else {
        for (const pCard of pending) {
          const pPicker = pCard.querySelector<HTMLElement>('[data-rw-picker]');
          if (pPicker && pPicker.hidden) {
            this.openInlinePicker(pCard, pPicker);
          }
        }
        this.revealCard(pending[0]);
      }

      const names = pending.map((c) => c.dataset.title || '').filter(Boolean).join(', ');
      const tpl = this.dataset.msgChoose || 'Pick a size for: [items]';
      if (msgEl) {
        msgEl.textContent = tpl.replace('[items]', names);
        msgEl.hidden = false;
      }
    }

    this.checkPanelComplete(panel);
  }

  private markCardAdded(card: HTMLElement): void {
    card.classList.add('is-added');
    const addBtn = card.querySelector<HTMLButtonElement>('[data-rw-add]');
    if (addBtn) {
      addBtn.setAttribute('aria-label', addBtn.dataset.addedLabel || 'Added to bag');
      addBtn.removeAttribute('aria-expanded');
    }
    if (this.isMobile && !this.reducedMotion && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(12);
      } catch {
        // Ignore
      }
    }
  }

  private checkPanelComplete(panel: HTMLElement): void {
    const cards = Array.from(panel.querySelectorAll<HTMLElement>('[data-rw-card]'));
    if (cards.length >= 2 && cards.every((c) => c.classList.contains('is-added'))) {
      panel.classList.add('is-complete');
      const msgEl = panel.querySelector<HTMLElement>('[data-rw-msg]');
      if (msgEl) {
        msgEl.textContent = '';
        msgEl.hidden = true;
      }
    }
  }

  private openLightbox(): void {
    const hero = this.heroes[this.index];
    if (!hero || this.zoomed) return;
    this.engage();
    this.clearHot();

    if (this.lbCloseTimer !== null) {
      clearTimeout(this.lbCloseTimer);
      this.lbCloseTimer = null;
    }

    const srcFig = hero.querySelector<HTMLElement>('.rw__figure');
    const srcShadow = hero.querySelector<HTMLElement>('.rw__shadow');
    if (!srcFig) return;

    const aRect = srcFig.getBoundingClientRect();
    this.lbStageEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'rw__lb-model';
    const footVal = hero.style.getPropertyValue('--rw-foot') || '0';
    wrap.style.setProperty('--rw-foot', footVal);

    if (srcShadow) {
      wrap.appendChild(srcShadow.cloneNode(true));
    }

    const figClone = srcFig.cloneNode(true) as HTMLElement;
    figClone.querySelector('[data-rw-zoom]')?.remove();
    figClone.querySelectorAll<HTMLButtonElement>('[data-rw-pin]').forEach((pin) => {
      pin.tabIndex = 0;
    });
    figClone.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      img.loading = 'eager';
      img.classList.add('is-decoded');
    });
    wrap.appendChild(figClone);
    this.lbStageEl.appendChild(wrap);

    const look = this.looks[this.index];
    const word = this.lbEl.dataset.word || 'Look';
    this.lbKickerEl.textContent = `${word} ${String(this.index + 1).padStart(2, '0')}`;
    this.lbNameEl.textContent = look?.name || '';

    this.sizeLightboxModel();

    this.zoomed = true;
    this.classList.add('rw--zoom');
    this.lbEl.setAttribute('aria-hidden', 'false');

    if (!this.reducedMotion) {
      const bRect = figClone.getBoundingClientRect();
      if (bRect.height > 0 && aRect.height > 0) {
        wrap.style.transition = 'none';
        wrap.style.transformOrigin = '0 100%';
        wrap.style.transform = `translate3d(${(aRect.left - bRect.left).toFixed(2)}px, ${(aRect.bottom - bRect.bottom).toFixed(2)}px, 0) scale(${(aRect.height / bRect.height).toFixed(4)})`;
        void wrap.offsetWidth;
        wrap.style.transition = '';
        wrap.style.transform = '';
      }
    }

    this.lbCloseEl.focus({ preventScroll: true });
  }

  private sizeLightboxModel(): void {
    const wrap = this.lbStageEl.querySelector<HTMLElement>('.rw__lb-model');
    if (!wrap) return;
    const sr = this.lbStageEl.getBoundingClientRect();
    const h = Math.max(160, Math.min(sr.height || 500, (sr.width || 400) / 0.5625));
    wrap.style.setProperty('--rw-model-h', `${Math.round(h)}px`);
    wrap.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      if (!img.src.startsWith('data:')) {
        img.sizes = `${Math.round(h * 0.5625)}px`;
      }
    });
  }

  private closeLightbox(immediate: boolean): void {
    if (!this.zoomed) return;
    this.zoomed = false;

    const wrap = this.lbStageEl.querySelector<HTMLElement>('.rw__lb-model');
    const figClone = wrap?.querySelector<HTMLElement>('.rw__figure');
    const srcFig = this.heroes[this.index]?.querySelector<HTMLElement>('.rw__figure');

    if (!immediate && !this.reducedMotion && wrap && figClone && srcFig) {
      const aRect = srcFig.getBoundingClientRect();
      const bRect = figClone.getBoundingClientRect();
      if (bRect.height > 0 && aRect.height > 0) {
        wrap.style.transformOrigin = '0 100%';
        wrap.style.transform = `translate3d(${(aRect.left - bRect.left).toFixed(2)}px, ${(aRect.bottom - bRect.bottom).toFixed(2)}px, 0) scale(${(aRect.height / bRect.height).toFixed(4)})`;
      }
    }

    const activeInside = this.lbEl.contains(document.activeElement);
    this.classList.remove('rw--zoom');
    this.lbEl.setAttribute('aria-hidden', 'true');
    if (activeInside) {
      this.stageEl.focus({ preventScroll: true });
    }

    if (this.lbCloseTimer !== null) clearTimeout(this.lbCloseTimer);
    if (immediate || this.reducedMotion) {
      this.lbStageEl.innerHTML = '';
    } else {
      this.lbCloseTimer = window.setTimeout(() => {
        if (!this.zoomed) {
          this.lbStageEl.innerHTML = '';
        }
        this.lbCloseTimer = null;
      }, 950);
    }
  }

  private updateCursorHoverState(target: HTMLElement | null): void {
    if (!this.cursorEl) return;
    if (this.dragging) {
      this.cursorEl.classList.remove('is-link', 'is-view');
      return;
    }
    const isLink = Boolean(target?.closest('.rw__pin, .rw__hit'));
    const isView = !isLink && Boolean(target?.closest('.rw__zoom'));
    this.cursorEl.classList.toggle('is-link', isLink);
    this.cursorEl.classList.toggle('is-view', isView);
  }

  private kickCursor(): void {
    if (!this.cursorEl || this.cursorRaf !== null) return;
    this.cursorRaf = requestAnimationFrame(() => {
      this.cursorRaf = null;
      if (!this.cursorEl) return;
      const factor = this.reducedMotion ? 1 : 0.18;
      this.cursorX += (this.cursorTargetX - this.cursorX) * factor;
      this.cursorY += (this.cursorTargetY - this.cursorY) * factor;
      this.cursorEl.style.transform = `translate3d(${this.cursorX.toFixed(1)}px, ${this.cursorY.toFixed(1)}px, 0)`;

      const dist = Math.hypot(this.cursorTargetX - this.cursorX, this.cursorTargetY - this.cursorY);
      if (dist >= 0.2 && this.cursorEntered) {
        this.kickCursor();
      }
    });
  }

  private attachImageDecode(img: HTMLImageElement): void {
    const mark = () => img.classList.add('is-decoded');
    if (img.complete && img.naturalWidth > 0) {
      mark();
      return;
    }
    if (typeof img.decode === 'function') {
      img.decode().then(mark).catch(() => {
        if (img.naturalWidth > 0) mark();
      });
    }
    img.addEventListener('load', mark, { once: true });
    img.addEventListener('error', mark, { once: true });
  }

  private probeFeet(look: NormalizedLook): void {
    if (look.isCustom) {
      this.applyFootOffset(look.index, 0);
      return;
    }
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => {
      try {
        const w = 48;
        const h = Math.max(1, Math.round((probe.naturalHeight / (probe.naturalWidth || 1)) * w));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(probe, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let lastRow = h - 1;
        outer: for (let y = h - 1; y >= 0; y--) {
          for (let x = 0; x < w; x++) {
            const alpha = data[(y * w + x) * 4 + 3];
            if (alpha > 40) {
              lastRow = y;
              break outer;
            }
          }
        }
        const offset = computeFeetOffset(lastRow, h);
        this.applyFootOffset(look.index, offset);
      } catch {
        this.applyFootOffset(look.index, 0);
      }
    };
    probe.src = look.image640;
  }

  private applyFootOffset(lookIndex: number, offset: number): void {
    this.footOffsets.set(lookIndex, offset);
    const val = offset.toFixed(4);
    const hero = this.heroes[lookIndex];
    if (hero) hero.style.setProperty('--rw-foot', val);
    for (const body of this.bodies) {
      if (body.lookIndex === lookIndex) {
        body.el.style.setProperty('--rw-foot', val);
      }
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export function registerRunwayElement(): void {
  if (!customElements.get('runway-section')) {
    customElements.define('runway-section', RunwaySection);
  }
}
