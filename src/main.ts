import './styles/runway.css';
import { StylingBagController } from './components/bag-dialog';
import { VirtualClosetController } from './components/closet-dialog';
import { type RunwaySection, registerRunwayElement } from './components/runway-element';
import { RUNWAY_LOOKS } from './data/catalog';
import { initThemeToggle } from './logic/theme';

registerRunwayElement();

function boot(): void {
  initThemeToggle();

  const runway = document.getElementById(
    'Runway-template--28035983671601__the_runway_wdM8BG'
  ) as RunwaySection | null;

  const bag = new StylingBagController({
    onInspectPiece: (productId) => {
      const look = RUNWAY_LOOKS.find((l) => l.pieces.some((p) => p.productId === productId));
      if (look) {
        runway?.selectLook(look.index);
      }
    },
  });

  const closet = new VirtualClosetController({
    onWornOutfitsChange: (wornOutfits, focusOutfitId) => {
      runway?.syncWornOutfits(wornOutfits, focusOutfitId);
    },
    onSelectArchiveLook: (lookIndex) => {
      runway?.selectLook(lookIndex);
    },
    onNotify: (msg) => {
      bag.showToast(msg);
    },
  });

  document.querySelector('[data-nav-lookbook]')?.addEventListener('click', (e) => {
    e.preventDefault();
    runway?.selectLook(0);
  });

  document.querySelector('[data-nav-closet]')?.addEventListener('click', (e) => {
    e.preventDefault();
    closet.openModal(false);
  });

  if (runway) {
    runway.setBagAdder((items) => bag.add(items));
    runway.setClosetHandler(() => closet.openModal(false));
    const initialWorn = closet.getInitialWornOutfits();
    if (initialWorn.length > 0) {
      runway.syncWornOutfits(initialWorn);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
