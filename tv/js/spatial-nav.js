// Robust Spatial Navigation & Remote Key Controller for Samsung Smart TV (BN59 Remotes)
(function () {
  'use strict';

  let currentElement = null;

  function getFocusables() {
    const selector = '.focusable, .tv-nav-item, .tv-cat-btn, .tv-card, .tv-stat-card, .tv-dock-btn, button, input';
    const all = Array.from(document.querySelectorAll(selector));
    return all.filter(el => {
      if (el.disabled) return false;
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
      let p = el.parentElement;
      while (p) {
        if (p.classList && (p.classList.contains('hidden') || p.style.display === 'none')) return false;
        p = p.parentElement;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  function setFocus(el) {
    if (!el) return;
    document.querySelectorAll('.focused').forEach(e => {
      if (e !== el) e.classList.remove('focused');
    });
    currentElement = el;
    el.classList.add('focused');
    try { el.focus(); } catch (e) {}
    try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); } catch (e) {}
  }

  function move(dir) {
    const list = getFocusables();
    if (!list.length) return;

    let active = document.activeElement;
    if (!active || !list.includes(active)) active = currentElement;
    if (!active || !list.includes(active)) {
      setFocus(list[0]);
      return;
    }

    const cRect = active.getBoundingClientRect();
    const cX = cRect.left + cRect.width / 2;
    const cY = cRect.top + cRect.height / 2;

    let best = null;
    let minScore = Infinity;

    for (let i = 0; i < list.length; i++) {
      const cand = list[i];
      if (cand === active) continue;

      const tRect = cand.getBoundingClientRect();
      const tX = tRect.left + tRect.width / 2;
      const tY = tRect.top + tRect.height / 2;

      const dx = tX - cX;
      const dy = tY - cY;

      let valid = false;
      let primary = 0;
      let secondary = 0;

      if (dir === 'up' && dy < -4) {
        valid = true;
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
      } else if (dir === 'down' && dy > 4) {
        valid = true;
        primary = Math.abs(dy);
        secondary = Math.abs(dx);
      } else if (dir === 'left' && dx < -4) {
        valid = true;
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
      } else if (dir === 'right' && dx > 4) {
        valid = true;
        primary = Math.abs(dx);
        secondary = Math.abs(dy);
      }

      if (valid) {
        const score = primary + (secondary * 2.2);
        if (score < minScore) {
          minScore = score;
          best = cand;
        }
      }
    }

    if (best) {
      setFocus(best);
    }
  }

  function executeSelection(el) {
    const target = el || document.activeElement || currentElement;
    if (!target) return;

    // Visual click feedback
    target.classList.add('tv-pressed');
    setTimeout(() => target.classList.remove('tv-pressed'), 180);

    // 1. Direct App API hooks
    const view = target.getAttribute('data-view');
    if (view && typeof window.tvSwitchView === 'function') {
      window.tvSwitchView(view);
      return;
    }

    const jump = target.getAttribute('data-jump');
    if (jump && typeof window.tvSwitchView === 'function') {
      window.tvSwitchView(jump);
      return;
    }

    if (target.id === 'tvQrBtn' && typeof window.tvOpenQr === 'function') {
      window.tvOpenQr();
      return;
    }

    if (target.id === 'tvCloseQrBtn' && typeof window.tvCloseQr === 'function') {
      window.tvCloseQr();
      return;
    }

    // 2. Trigger native onclick
    if (typeof target.onclick === 'function') {
      try { target.onclick(new MouseEvent('click')); } catch (e) {}
    }

    // 3. Trigger DOM click
    try { target.click(); } catch (e) {}

    // 4. Dispatch synthetic MouseEvent
    try {
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
      target.dispatchEvent(evt);
    } catch (e) {}
  }

  function handleKeyDown(e) {
    const key = e.keyCode || e.which;
    const keyName = e.key || '';

    // Check if fullscreen video is open
    const fs = document.getElementById('tvFsPlayer');
    if (fs && !fs.classList.contains('hidden')) {
      return;
    }

    // Samsung D-Pad Up
    if (key === 38 || keyName === 'ArrowUp' || keyName === 'Up') {
      e.preventDefault();
      move('up');
    }
    // Samsung D-Pad Down
    else if (key === 40 || keyName === 'ArrowDown' || keyName === 'Down') {
      e.preventDefault();
      move('down');
    }
    // Samsung D-Pad Left
    else if (key === 37 || keyName === 'ArrowLeft' || keyName === 'Left') {
      e.preventDefault();
      move('left');
    }
    // Samsung D-Pad Right
    else if (key === 39 || keyName === 'ArrowRight' || keyName === 'Right') {
      e.preventDefault();
      move('right');
    }
    // Samsung Remote Enter / Center [↵] Button (Codes: 13, 65385, 29443, 10252)
    else if (
      key === 13 || key === 65385 || key === 29443 || key === 10252 ||
      keyName === 'Enter' || keyName === 'Select' || keyName === 'Accept' || keyName === 'Ok'
    ) {
      e.preventDefault();
      executeSelection();
    }
    // Return / Back Key (10009, 27, 8)
    else if (key === 10009 || key === 27 || key === 8 || keyName === 'Escape' || keyName === 'Backspace') {
      const qr = document.getElementById('tvQrModal');
      if (qr && !qr.classList.contains('hidden')) {
        e.preventDefault();
        if (typeof window.tvCloseQr === 'function') window.tvCloseQr();
      }
    }
  }

  window.SpatialNav = {
    setFocus: setFocus,
    move: move,
    init: function () {
      setTimeout(() => {
        const list = getFocusables();
        if (list.length > 0) {
          const active = document.querySelector('.tv-nav-item.active') || list[0];
          setFocus(active);
        }
      }, 150);
    }
  };

  // Sync focus tracking
  document.addEventListener('focusin', (e) => {
    if (e.target) setFocus(e.target);
  }, true);

  window.addEventListener('keydown', handleKeyDown, true);

  window.addEventListener('load', () => {
    setTimeout(window.SpatialNav.init, 200);
  });

})();
