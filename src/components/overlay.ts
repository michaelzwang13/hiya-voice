import type { FormField, FormInfo, InsertPhrase } from '../types/form';

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
  public onAddPhrase?: (name: string, content: string) => void;
  public onDeletePhrase?: (id: string) => void;

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
    this.container.id = 'clara-overlay-container';

    // Fetch and inject the HTML
    const overlayHTML = `
      <div id="clara-overlay" class="clara-overlay">
        <div class="clara-resize-handle"></div>

        <!-- Minimized Tab (visible when overlay is minimized) -->
        <div class="clara-minimized-tab" id="clara-minimized-tab">
          <div class="clara-tab-content">
            <span class="clara-tab-icon">🎙️</span>
            <span class="clara-tab-text">Clara</span>
          </div>
        </div>

        <div class="clara-header">
          <div class="clara-title">
            <span class="clara-icon">🎙️</span>
            <span>Clara Voice Assistant</span>
          </div>
          <button class="clara-toggle-btn" id="clara-toggle" title="Toggle Sidebar (Ctrl+B)">
            <span class="clara-toggle-icon">−</span>
          </button>
        </div>

        <div class="clara-content">
          <div class="clara-status-section">
            <div class="clara-status-item">
              <span class="clara-label">Form Status:</span>
              <span id="clara-form-status" class="clara-value">No form detected</span>
            </div>
            <div class="clara-status-item">
              <span class="clara-label">Fields:</span>
              <span id="clara-fields-count" class="clara-value">0</span>
            </div>
            <div class="clara-status-item">
              <span class="clara-label">Progress:</span>
              <div class="clara-progress-container">
                <div id="clara-progress-bar" class="clara-progress-bar" style="width: 0%"></div>
                <span id="clara-progress-text" class="clara-progress-text">0%</span>
              </div>
            </div>
          </div>

          <div class="clara-current-field-section">
            <div class="clara-section-title">Current Field</div>
            <div class="clara-current-field">
              <div class="clara-field-info">
                <span id="clara-field-index" class="clara-field-index">-</span>
                <span id="clara-field-label" class="clara-field-label">No field selected</span>
              </div>
              <div id="clara-field-type" class="clara-field-type">-</div>
              <div id="clara-field-value" class="clara-field-value">Empty</div>
            </div>
          </div>

          <div class="clara-controls-section">
            <div class="clara-section-title">Navigation</div>
            <div class="clara-controls">
              <button id="clara-prev-btn" class="clara-btn clara-btn-secondary">
                ← Previous
              </button>
              <button id="clara-next-btn" class="clara-btn clara-btn-secondary">
                Next →
              </button>
            </div>
            <button id="clara-jump-unfilled" class="clara-btn clara-btn-outline">
              Jump to Required
            </button>
          </div>

          <div class="clara-insert-section">
            <div class="clara-section-title">Insert Phrases</div>
            <div class="clara-insert-help">
              Say "insert [phrase name]" to use a saved phrase
            </div>
            <div class="clara-insert-form">
              <input type="text" id="clara-phrase-name" class="clara-input" placeholder="Phrase name (e.g., 'resume')">
              <textarea id="clara-phrase-content" class="clara-textarea" placeholder="Content to insert..." rows="3"></textarea>
              <button id="clara-add-phrase" class="clara-btn clara-btn-primary">Add Phrase</button>
            </div>
            <div id="clara-phrases-list" class="clara-phrases-list">
              <!-- Phrases will be dynamically added here -->
            </div>
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
    const styleId = 'clara-overlay-styles';
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
    const toggleBtn = document.getElementById('clara-toggle');
    toggleBtn?.addEventListener('click', () => this.toggle());

    // Click minimized tab to expand
    const minimizedTab = document.getElementById('clara-minimized-tab');
    minimizedTab?.addEventListener('click', () => this.show());

    // Navigation buttons
    const nextBtn = document.getElementById('clara-next-btn');
    nextBtn?.addEventListener('click', () => this.onNextField?.());

    const prevBtn = document.getElementById('clara-prev-btn');
    prevBtn?.addEventListener('click', () => this.onPreviousField?.());

    const jumpBtn = document.getElementById('clara-jump-unfilled');
    jumpBtn?.addEventListener('click', () => this.onJumpToUnfilled?.());

    // Insert phrase button
    const addPhraseBtn = document.getElementById('clara-add-phrase');
    addPhraseBtn?.addEventListener('click', () => this.handleAddPhrase());
  }

  /**
   * Handles adding a new phrase
   */
  private handleAddPhrase(): void {
    const nameInput = document.getElementById('clara-phrase-name') as HTMLInputElement;
    const contentInput = document.getElementById('clara-phrase-content') as HTMLTextAreaElement;

    if (!nameInput || !contentInput) return;

    const name = nameInput.value.trim();
    const content = contentInput.value.trim();

    if (!name || !content) {
      alert('Please enter both phrase name and content');
      return;
    }

    // Call the handler
    this.onAddPhrase?.(name, content);

    // Clear inputs
    nameInput.value = '';
    contentInput.value = '';
  }

  /**
   * Sets up resizing functionality
   */
  private setupResizing(): void {
    const resizeHandle = document.querySelector('.clara-resize-handle') as HTMLElement;
    const overlay = document.getElementById('clara-overlay') as HTMLElement;

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
    const statusEl = document.getElementById('clara-form-status');
    const fieldsCountEl = document.getElementById('clara-fields-count');
    const progressBar = document.getElementById('clara-progress-bar');
    const progressText = document.getElementById('clara-progress-text');

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
    const fieldIndexEl = document.getElementById('clara-field-index');
    const fieldLabelEl = document.getElementById('clara-field-label');
    const fieldTypeEl = document.getElementById('clara-field-type');
    const fieldValueEl = document.getElementById('clara-field-value');

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
   * Updates the phrases list display
   */
  public updatePhrasesList(phrases: InsertPhrase[]): void {
    const phrasesList = document.getElementById('clara-phrases-list');
    if (!phrasesList) return;

    if (phrases.length === 0) {
      phrasesList.innerHTML = '<div class="clara-no-phrases">No phrases saved yet</div>';
      return;
    }

    phrasesList.innerHTML = phrases.map(phrase => `
      <div class="clara-phrase-item" data-phrase-id="${phrase.id}">
        <div class="clara-phrase-header">
          <strong class="clara-phrase-name">${this.escapeHtml(phrase.name)}</strong>
          <button class="clara-phrase-delete" data-phrase-id="${phrase.id}" title="Delete phrase">×</button>
        </div>
        <div class="clara-phrase-content">${this.escapeHtml(phrase.content)}</div>
      </div>
    `).join('');

    // Add delete button listeners
    const deleteButtons = phrasesList.querySelectorAll('.clara-phrase-delete');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const phraseId = target.getAttribute('data-phrase-id');
        if (phraseId) {
          this.onDeletePhrase?.(phraseId);
        }
      });
    });
  }

  /**
   * Escapes HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Toggles the overlay visibility
   */
  public toggle(): void {
    const overlay = document.getElementById('clara-overlay');
    const toggleIcon = document.querySelector('.clara-toggle-icon');

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
    const overlay = document.getElementById('clara-overlay');
    const toggleIcon = document.querySelector('.clara-toggle-icon');

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
    const overlay = document.getElementById('clara-overlay');
    const toggleIcon = document.querySelector('.clara-toggle-icon');

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
    document.getElementById('clara-overlay-styles')?.remove();
  }
}
