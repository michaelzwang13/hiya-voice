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
          <button class="hiya-toggle-btn" id="hiya-toggle" title="Toggle Sidebar (Ctrl+B)">
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

          <div class="hiya-insert-section">
            <div class="hiya-section-title">Insert Phrases</div>
            <div class="hiya-insert-help">
              Say "insert [phrase name]" to use a saved phrase
            </div>
            <div class="hiya-insert-form">
              <input type="text" id="hiya-phrase-name" class="hiya-input" placeholder="Phrase name (e.g., 'resume')">
              <textarea id="hiya-phrase-content" class="hiya-textarea" placeholder="Content to insert..." rows="3"></textarea>
              <button id="hiya-add-phrase" class="hiya-btn hiya-btn-primary">Add Phrase</button>
            </div>
            <div id="hiya-phrases-list" class="hiya-phrases-list">
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

    // Insert phrase button
    const addPhraseBtn = document.getElementById('hiya-add-phrase');
    addPhraseBtn?.addEventListener('click', () => this.handleAddPhrase());
  }

  /**
   * Handles adding a new phrase
   */
  private handleAddPhrase(): void {
    const nameInput = document.getElementById('hiya-phrase-name') as HTMLInputElement;
    const contentInput = document.getElementById('hiya-phrase-content') as HTMLTextAreaElement;

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
   * Updates the phrases list display
   */
  public updatePhrasesList(phrases: InsertPhrase[]): void {
    const phrasesList = document.getElementById('hiya-phrases-list');
    if (!phrasesList) return;

    if (phrases.length === 0) {
      phrasesList.innerHTML = '<div class="hiya-no-phrases">No phrases saved yet</div>';
      return;
    }

    phrasesList.innerHTML = phrases.map(phrase => `
      <div class="hiya-phrase-item" data-phrase-id="${phrase.id}">
        <div class="hiya-phrase-header">
          <strong class="hiya-phrase-name">${this.escapeHtml(phrase.name)}</strong>
          <button class="hiya-phrase-delete" data-phrase-id="${phrase.id}" title="Delete phrase">×</button>
        </div>
        <div class="hiya-phrase-content">${this.escapeHtml(phrase.content)}</div>
      </div>
    `).join('');

    // Add delete button listeners
    const deleteButtons = phrasesList.querySelectorAll('.hiya-phrase-delete');
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
