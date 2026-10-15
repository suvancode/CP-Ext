/**
 * ContinueO Auto Login - In-Page Status Overlay (HUD)
 *
 * Provides non-intrusive visual feedback on the ContinueO portal during
 * automation sequence. Self-dismisses on completion.
 */
(function(root) {
  'use strict';

  let overlayElement = null;
  let statusTextElement = null;
  let iconElement = null;
  let actionContainer = null;
  let dismissTimer = null;

  const ContinueOOverlay = {
    /**
     * Initializes or gets the existing overlay in the DOM.
     */
    init() {
      if (overlayElement && document.contains(overlayElement)) {
        return overlayElement;
      }

      overlayElement = document.createElement('div');
      overlayElement.id = 'continueo-hud-container';
      overlayElement.setAttribute('aria-live', 'polite');

      // Styles applied directly to prevent host page CSS collisions
      Object.assign(overlayElement.style, {
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: '2147483647',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        background: 'rgba(21, 47, 90, 0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        padding: '12px 16px',
        maxWidth: '340px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        opacity: '0',
        transform: 'translateY(-10px)',
        pointerEvents: 'auto'
      });

      // Header row
      const headerRow = document.createElement('div');
      Object.assign(headerRow.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        paddingBottom: '6px'
      });

      const title = document.createElement('div');
      title.textContent = 'ContinueO Auto Login';
      Object.assign(title.style, {
        fontWeight: '600',
        fontSize: '12px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color: '#60a5fa'
      });

      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('title', 'Dismiss');
      Object.assign(closeBtn.style, {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '0 4px',
        lineHeight: '1'
      });
      closeBtn.addEventListener('click', () => ContinueOOverlay.hide());

      headerRow.appendChild(title);
      headerRow.appendChild(closeBtn);

      // Body row (icon + status text)
      const bodyRow = document.createElement('div');
      Object.assign(bodyRow.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      });

      iconElement = document.createElement('div');
      iconElement.id = 'continueo-hud-icon';
      Object.assign(iconElement.style, {
        fontSize: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      statusTextElement = document.createElement('div');
      statusTextElement.id = 'continueo-hud-text';
      statusTextElement.textContent = 'Initializing…';
      Object.assign(statusTextElement.style, {
        lineHeight: '1.4',
        fontWeight: '500'
      });

      bodyRow.appendChild(iconElement);
      bodyRow.appendChild(statusTextElement);

      // Action container for retry / manual intervention buttons
      actionContainer = document.createElement('div');
      actionContainer.id = 'continueo-hud-actions';
      Object.assign(actionContainer.style, {
        display: 'none',
        gap: '8px',
        marginTop: '4px'
      });

      overlayElement.appendChild(headerRow);
      overlayElement.appendChild(bodyRow);
      overlayElement.appendChild(actionContainer);

      document.body.appendChild(overlayElement);

      // Animate in
      requestAnimationFrame(() => {
        overlayElement.style.opacity = '1';
        overlayElement.style.transform = 'translateY(0)';
      });

      return overlayElement;
    },

    /**
     * Updates overlay display based on state machine state.
     */
    update(state, message, details = {}) {
      this.init();
      if (dismissTimer) clearTimeout(dismissTimer);

      statusTextElement.textContent = message || state;
      actionContainer.innerHTML = '';
      actionContainer.style.display = 'none';

      // Spinner SVG
      const spinnerSvg = `
        <svg style="animation: contSpin 1s linear infinite; width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="3" stroke-dasharray="32" stroke-linecap="round"></circle>
        </svg>
      `;

      if (!document.getElementById('continueo-hud-spin-style')) {
        const style = document.createElement('style');
        style.id = 'continueo-hud-spin-style';
        style.textContent = `@keyframes contSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
      }

      switch (state) {
        case 'COMPLETED':
          iconElement.innerHTML = '✓';
          iconElement.style.color = '#34d399';
          statusTextElement.style.color = '#a7f3d0';
          // Auto fade out after 3 seconds to clear the normal portal
          dismissTimer = setTimeout(() => this.hide(), 3500);
          break;

        case 'ERROR':
          iconElement.innerHTML = '⚠';
          iconElement.style.color = '#f87171';
          statusTextElement.style.color = '#fca5a5';
          this.showActionButton('Dismiss', () => this.hide());
          break;

        case 'MANUAL_INTERVENTION_REQUIRED':
          iconElement.innerHTML = '✋';
          iconElement.style.color = '#fbbf24';
          statusTextElement.style.color = '#fde68a';
          this.showActionButton('Continue Manually', () => this.hide());
          break;

        default:
          iconElement.innerHTML = spinnerSvg;
          statusTextElement.style.color = '#f1f5f9';
          break;
      }
    },

    showActionButton(label, onClick) {
      actionContainer.style.display = 'flex';
      const btn = document.createElement('button');
      btn.textContent = label;
      Object.assign(btn.style, {
        background: 'rgba(255, 255, 255, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        color: '#ffffff',
        padding: '4px 10px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: '500'
      });
      btn.addEventListener('click', onClick);
      actionContainer.appendChild(btn);
    },

    hide() {
      if (!overlayElement) return;
      overlayElement.style.opacity = '0';
      overlayElement.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (overlayElement && overlayElement.parentNode) {
          overlayElement.parentNode.removeChild(overlayElement);
          overlayElement = null;
        }
      }, 350);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContinueOOverlay;
  }
  if (root) {
    root.ContinueOOverlay = ContinueOOverlay;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
