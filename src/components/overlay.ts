import type { FormField, FormInfo } from '../types/form';

export class VoiceAssistantOverlay {
  private container: HTMLElement | null = null;
  private isMinimized = false;
  private isResizing = false;
  private startX = 0;
  private startWidth = 0;

  // Event handlers
  public onNextField?: () => void;
  public onPreviousField?: () => void;
  public onJumpToUnfilled?: () => void;

  constructor() {
    this.injectOverlay();
    this.attachEventListeners();
    this.setupResizing();
  }

  /**
   * Injects the overlay HTML into the page
   */
  private injectOverlay(): void {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'hiya-overlay-container';

    // Fetch and inject the HTML
    const overlayHTML = `
      <div id="hiya-overlay" class="hiya-overlay">
        <div class="hiya-resize-handle"></div>

        <!-- Minimized Tab (visible when overlay is minimized) -->
        <div class="hiya-minimized-tab" id="hiya-minimized-tab">
          <div class="hiya-tab-content">
            <span class="hiya-tab-icon">🎙️</span>
            <span class="hiya-tab-text">Hiya</span>
          </div>
        </div>

        <div class="hiya-header">
          <div class="hiya-title">
            <span class="hiya-icon">🎙️</span>
            <span>Hiya Voice Assistant</span>
          </div>
          <button class="hiya-toggle-btn" id="hiya-toggle" title="Minimize (Alt+V)">
            <span class="hiya-toggle-icon">−</span>
          </button>
        </div>

        <div class="hiya-content">
          <div class="hiya-status-section">
            <div class="hiya-status-item">
              <span class="hiya-label">Form Status:</span>
              <span id="hiya-form-status" class="hiya-value">No form detected</span>
            </div>
            <div class="hiya-status-item">
              <span class="hiya-label">Fields:</span>
              <span id="hiya-fields-count" class="hiya-value">0</span>
            </div>
            <div class="hiya-status-item">
              <span class="hiya-label">Progress:</span>
              <div class="hiya-progress-container">
                <div id="hiya-progress-bar" class="hiya-progress-bar" style="width: 0%"></div>
                <span id="hiya-progress-text" class="hiya-progress-text">0%</span>
              </div>
            </div>
          </div>

          <div class="hiya-current-field-section">
            <div class="hiya-section-title">Current Field</div>
            <div class="hiya-current-field">
              <div class="hiya-field-info">
                <span id="hiya-field-index" class="hiya-field-index">-</span>
                <span id="hiya-field-label" class="hiya-field-label">No field selected</span>
              </div>
              <div id="hiya-field-type" class="hiya-field-type">-</div>
              <div id="hiya-field-value" class="hiya-field-value">Empty</div>
            </div>
          </div>

          <div class="hiya-controls-section">
            <div class="hiya-section-title">Navigation</div>
            <div class="hiya-controls">
              <button id="hiya-prev-btn" class="hiya-btn hiya-btn-secondary">
                ← Previous
              </button>
              <button id="hiya-next-btn" class="hiya-btn hiya-btn-secondary">
                Next →
              </button>
            </div>
            <button id="hiya-jump-unfilled" class="hiya-btn hiya-btn-outline">
              Jump to Required
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = overlayHTML;

    // Inject CSS
    this.injectStyles();

    // Add to page
    document.body.appendChild(this.container);
  }

  /**
   * Injects the CSS styles
   */
  private injectStyles(): void {
    const styleId = 'hiya-overlay-styles';
    if (document.getElementById(styleId)) return;

    const link = document.createElement('link');
    link.id = styleId;
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('components/overlay.css');
    document.head.appendChild(link);
  }

  /**
   * Attaches event listeners to buttons
   */
  private attachEventListeners(): void {
    // Toggle minimize
    const toggleBtn = document.getElementById('hiya-toggle');
    toggleBtn?.addEventListener('click', () => this.toggle());

    // Click minimized tab to expand
    const minimizedTab = document.getElementById('hiya-minimized-tab');
    minimizedTab?.addEventListener('click', () => this.show());

    // Navigation buttons
    const nextBtn = document.getElementById('hiya-next-btn');
    nextBtn?.addEventListener('click', () => this.onNextField?.());

    const prevBtn = document.getElementById('hiya-prev-btn');
    prevBtn?.addEventListener('click', () => this.onPreviousField?.());

    const jumpBtn = document.getElementById('hiya-jump-unfilled');
    jumpBtn?.addEventListener('click', () => this.onJumpToUnfilled?.());
  }

  /**
   * Sets up resizing functionality
   */
  private setupResizing(): void {
    const resizeHandle = document.querySelector('.hiya-resize-handle') as HTMLElement;
    const overlay = document.getElementById('hiya-overlay') as HTMLElement;

    if (!resizeHandle || !overlay) return;

    resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      this.isResizing = true;
      this.startX = e.clientX;
      this.startWidth = overlay.offsetWidth;
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isResizing) return;

      const deltaX = this.startX - e.clientX;
      const newWidth = Math.min(Math.max(300, this.startWidth + deltaX), 600);
      overlay.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.style.cursor = '';
      }
    });
  }

  /**
   * Updates the form status display
   */
  public updateFormStatus(formInfo: FormInfo): void {
    const statusEl = document.getElementById('hiya-form-status');
    const fieldsCountEl = document.getElementById('hiya-fields-count');
    const progressBar = document.getElementById('hiya-progress-bar');
    const progressText = document.getElementById('hiya-progress-text');

    if (statusEl) {
      statusEl.textContent = formInfo.totalFields > 0 ? 'Form detected' : 'No form detected';
    }

    if (fieldsCountEl) {
      fieldsCountEl.textContent = `${formInfo.filledFields} / ${formInfo.totalFields}`;
    }

    if (progressBar && progressText) {
      const percentage = formInfo.totalFields > 0
        ? Math.round((formInfo.filledFields / formInfo.totalFields) * 100)
        : 0;
      progressBar.style.width = `${percentage}%`;
      progressText.textContent = `${percentage}%`;
    }
  }

  /**
   * Updates the current field display
   */
  public updateCurrentField(field: FormField | null, index: number, total: number): void {
    const fieldIndexEl = document.getElementById('hiya-field-index');
    const fieldLabelEl = document.getElementById('hiya-field-label');
    const fieldTypeEl = document.getElementById('hiya-field-type');
    const fieldValueEl = document.getElementById('hiya-field-value');

    if (!field) {
      if (fieldIndexEl) fieldIndexEl.textContent = '-';
      if (fieldLabelEl) fieldLabelEl.textContent = 'No field selected';
      if (fieldTypeEl) fieldTypeEl.textContent = '-';
      if (fieldValueEl) fieldValueEl.textContent = 'Empty';
      return;
    }

    if (fieldIndexEl) {
      fieldIndexEl.textContent = `${index + 1} / ${total}`;
    }

    if (fieldLabelEl) {
      fieldLabelEl.textContent = field.label;
    }

    if (fieldTypeEl) {
      fieldTypeEl.textContent = field.type;
    }

    if (fieldValueEl) {
      fieldValueEl.textContent = field.value || 'Empty';
    }
  }

  /**
   * Toggles the overlay visibility
   */
  public toggle(): void {
    const overlay = document.getElementById('hiya-overlay');
    const toggleIcon = document.querySelector('.hiya-toggle-icon');

    if (!overlay) return;

    this.isMinimized = !this.isMinimized;

    if (this.isMinimized) {
      overlay.classList.add('minimized');
      if (toggleIcon) toggleIcon.textContent = '+';
    } else {
      overlay.classList.remove('minimized');
      if (toggleIcon) toggleIcon.textContent = '−';
    }
  }

  /**
   * Shows the overlay
   */
  public show(): void {
    const overlay = document.getElementById('hiya-overlay');
    const toggleIcon = document.querySelector('.hiya-toggle-icon');

    if (overlay) {
      overlay.classList.remove('minimized');
      this.isMinimized = false;
      if (toggleIcon) toggleIcon.textContent = '−';
    }
  }

  /**
   * Hides the overlay
   */
  public hide(): void {
    const overlay = document.getElementById('hiya-overlay');
    const toggleIcon = document.querySelector('.hiya-toggle-icon');

    if (overlay) {
      overlay.classList.add('minimized');
      this.isMinimized = true;
      if (toggleIcon) toggleIcon.textContent = '+';
    }
  }

  /**
   * Removes the overlay from the page
   */
  public destroy(): void {
    this.container?.remove();
    document.getElementById('hiya-overlay-styles')?.remove();
  }
}
