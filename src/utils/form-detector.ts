import type { FormField, FormInfo, FieldType } from '../types/form';

export class FormDetector {
  private fields: FormField[] = [];
  private currentFieldIndex = -1;
  private readonly HIGHLIGHT_CLASS = 'hiya-current-field';

  /**
   * Detects all form fields on the current page
   */
  detectForms(): FormInfo {
    this.fields = [];

    // Find all input, textarea, and select elements
    const inputElements = Array.from(
      document.querySelectorAll('input, textarea, select')
    );

    inputElements.forEach((element, index) => {
      const field = this.createFormField(element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, index);
      if (field) {
        this.fields.push(field);
      }
    });

    const formElement = document.querySelector('form');
    const requiredFields = this.fields.filter(f => f.required).length;
    const filledFields = this.fields.filter(f => f.value.trim() !== '').length;

    console.log(`[Hiya] Detected ${this.fields.length} form fields`);

    return {
      fields: this.fields,
      formElement,
      totalFields: this.fields.length,
      requiredFields,
      filledFields,
    };
  }

  /**
   * Creates a FormField object from a DOM element
   */
  private createFormField(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    index: number
  ): FormField | null {
    // Skip hidden and disabled fields
    if (
      element.type === 'hidden' ||
      element.disabled ||
      element.style.display === 'none'
    ) {
      return null;
    }

    const label = this.extractLabel(element);
    const type = this.detectFieldType(element);

    return {
      element,
      type,
      label,
      placeholder: element.getAttribute('placeholder') || undefined,
      required: element.required || element.getAttribute('aria-required') === 'true',
      value: this.getFieldValue(element),
      id: element.id || `hiya-field-${index}`,
    };
  }

  /**
   * Extracts the label for a form field
   */
  private extractLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
    // Try multiple methods to find the label

    // 1. Associated <label> element
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label?.textContent) {
        return this.cleanLabel(label.textContent);
      }
    }

    // 2. Parent <label> element
    const parentLabel = element.closest('label');
    if (parentLabel) {
      // Clone and remove the input to get just the label text
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      const inputs = clone.querySelectorAll('input, textarea, select');
      inputs.forEach(input => input.remove());
      if (clone.textContent?.trim()) {
        return this.cleanLabel(clone.textContent);
      }
    }

    // 3. aria-label attribute
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return this.cleanLabel(ariaLabel);
    }

    // 4. aria-labelledby attribute
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement?.textContent) {
        return this.cleanLabel(labelElement.textContent);
      }
    }

    // 5. aria-describedby attribute
    const ariaDescribedBy = element.getAttribute('aria-describedby');
    if (ariaDescribedBy) {
      const descElement = document.getElementById(ariaDescribedBy);
      if (descElement?.textContent) {
        return this.cleanLabel(descElement.textContent);
      }
    }

    // 6. Previous sibling text (common in div-based forms)
    const previousSibling = element.previousElementSibling;
    if (previousSibling && (previousSibling.tagName === 'LABEL' || previousSibling.tagName === 'SPAN' || previousSibling.tagName === 'DIV')) {
      const text = previousSibling.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        return this.cleanLabel(text);
      }
    }

    // 7. Preceding heading (h1-h6)
    let current = element.previousElementSibling;
    let attempts = 0;
    while (current && attempts < 3) {
      if (/^H[1-6]$/.test(current.tagName)) {
        return this.cleanLabel(current.textContent || '');
      }
      current = current.previousElementSibling;
      attempts++;
    }

    // 8. Parent element's data attributes
    const parent = element.parentElement;
    if (parent) {
      const dataLabel = parent.getAttribute('data-label') || parent.getAttribute('data-field-label');
      if (dataLabel) {
        return this.cleanLabel(dataLabel);
      }
    }

    // 9. Placeholder as fallback
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      return this.cleanLabel(placeholder);
    }

    // 10. Title attribute
    const title = element.getAttribute('title');
    if (title) {
      return this.cleanLabel(title);
    }

    // 11. Name attribute as last resort
    const name = element.getAttribute('name');
    if (name) {
      return this.cleanLabel(name.replace(/[_-]/g, ' '));
    }

    return 'Unlabeled field';
  }

  /**
   * Cleans and formats a label string
   */
  private cleanLabel(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[*:]\s*$/, '') // Remove trailing asterisks or colons
      .trim();
  }

  /**
   * Detects the type of a form field
   */
  private detectFieldType(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): FieldType {
    if (element instanceof HTMLTextAreaElement) {
      return 'textarea';
    }

    if (element instanceof HTMLSelectElement) {
      return 'select';
    }

    const type = element.type.toLowerCase();
    const name = element.name?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';
    const placeholder = element.placeholder?.toLowerCase() || '';
    const autocomplete = element.getAttribute('autocomplete')?.toLowerCase() || '';

    // Map input types
    switch (type) {
      case 'email':
        return 'email';
      case 'tel':
        return 'phone';
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'url':
        return 'url';
      case 'password':
        return 'password';
      case 'checkbox':
        return 'checkbox';
      case 'radio':
        return 'radio';
      case 'file':
        return 'file';
    }

    // Use autocomplete attribute (most reliable)
    if (autocomplete) {
      if (autocomplete.includes('email')) return 'email';
      if (autocomplete.includes('tel')) return 'phone';
      if (autocomplete === 'name' || autocomplete === 'full-name') return 'name';
      if (autocomplete.includes('given-name') || autocomplete === 'fname') return 'firstName';
      if (autocomplete.includes('family-name') || autocomplete === 'lname') return 'lastName';
      if (autocomplete.includes('address-line') || autocomplete === 'street-address') return 'address';
      if (autocomplete.includes('address-level2')) return 'city';
      if (autocomplete.includes('address-level1')) return 'state';
      if (autocomplete.includes('postal-code')) return 'zip';
      if (autocomplete.includes('country')) return 'country';
      if (autocomplete.includes('organization')) return 'company';
      if (autocomplete.includes('organization-title')) return 'jobTitle';
    }

    // Infer type from combined attributes and label
    const label = this.extractLabel(element).toLowerCase();
    const combined = `${name} ${id} ${placeholder} ${label}`.toLowerCase();

    // Email detection
    if (combined.includes('email') || combined.includes('e-mail')) return 'email';

    // Phone detection
    if (combined.includes('phone') || combined.includes('tel') || combined.includes('mobile') || combined.includes('cell')) return 'phone';

    // URL detection
    if (combined.includes('url') || combined.includes('website') || combined.includes('link')) return 'url';

    // Date detection
    if (combined.includes('date') || combined.includes('birth') || combined.includes('dob')) return 'date';

    // Name detection
    if (combined.match(/\b(first[\s-]?name|fname|given[\s-]?name)\b/)) return 'firstName';
    if (combined.match(/\b(last[\s-]?name|lname|surname|family[\s-]?name)\b/)) return 'lastName';
    if (combined.match(/\b(full[\s-]?name|your[\s-]?name|name)\b/) && !combined.includes('user')) return 'name';

    // Address detection
    if (combined.match(/\b(street|address[\s-]?line|address)\b/) && !combined.includes('email')) return 'address';
    if (combined.match(/\b(city|town)\b/)) return 'city';
    if (combined.match(/\b(state|province|region)\b/)) return 'state';
    if (combined.match(/\b(zip|postal[\s-]?code|postcode)\b/)) return 'zip';
    if (combined.match(/\b(country|nation)\b/)) return 'country';

    // Professional info
    if (combined.match(/\b(company|organization|employer)\b/)) return 'company';
    if (combined.match(/\b(job[\s-]?title|position|role|title)\b/) && !combined.includes('page')) return 'jobTitle';

    return 'text';
  }

  /**
   * Gets the current value of a form field
   */
  private getFieldValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
    if (element instanceof HTMLSelectElement) {
      return element.options[element.selectedIndex]?.text || '';
    }

    if ((element as HTMLInputElement).type === 'checkbox' || (element as HTMLInputElement).type === 'radio') {
      return (element as HTMLInputElement).checked ? 'checked' : '';
    }

    return element.value || '';
  }

  /**
   * Gets all detected fields
   */
  getFields(): FormField[] {
    return this.fields;
  }

  /**
   * Gets the current field
   */
  getCurrentField(): FormField | null {
    if (this.currentFieldIndex < 0 || this.currentFieldIndex >= this.fields.length) {
      return null;
    }
    return this.fields[this.currentFieldIndex];
  }

  /**
   * Moves to the next field
   */
  nextField(): FormField | null {
    if (this.fields.length === 0) return null;

    this.currentFieldIndex = (this.currentFieldIndex + 1) % this.fields.length;
    const field = this.fields[this.currentFieldIndex];
    this.highlightField(field);

    return field;
  }

  /**
   * Moves to the previous field
   */
  previousField(): FormField | null {
    if (this.fields.length === 0) return null;

    this.currentFieldIndex = this.currentFieldIndex <= 0
      ? this.fields.length - 1
      : this.currentFieldIndex - 1;

    const field = this.fields[this.currentFieldIndex];
    this.highlightField(field);

    return field;
  }

  /**
   * Highlights a field with visual feedback
   */
  private highlightField(field: FormField): void {
    // Remove highlight from all fields
    this.fields.forEach(f => {
      f.element.classList.remove(this.HIGHLIGHT_CLASS);
    });

    // Add highlight to current field
    field.element.classList.add(this.HIGHLIGHT_CLASS);

    // Focus and scroll into view
    field.element.focus();
    field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Inject highlight styles if not already present
    this.injectHighlightStyles();
  }

  /**
   * Injects CSS styles for field highlighting
   */
  private injectHighlightStyles(): void {
    if (document.getElementById('hiya-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'hiya-highlight-styles';
    style.textContent = `
      .${this.HIGHLIGHT_CLASS} {
        outline: 3px solid #4F46E5 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.2) !important;
        transition: all 0.2s ease-in-out !important;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Fills the current field with a value
   */
  fillCurrentField(value: string): boolean {
    const field = this.getCurrentField();
    if (!field) return false;

    field.element.value = value;
    field.value = value;

    // Trigger change event
    field.element.dispatchEvent(new Event('input', { bubbles: true }));
    field.element.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  }

  /**
   * Gets form completion statistics
   */
  getFormState(): {
    totalFields: number;
    filledFields: number;
    requiredFields: number;
    requiredFilledFields: number;
    completionPercentage: number;
    isComplete: boolean;
  } {
    const totalFields = this.fields.length;
    const filledFields = this.fields.filter(f => {
      const value = f.element.value?.trim();
      if (f.type === 'checkbox' || f.type === 'radio') {
        return (f.element as HTMLInputElement).checked;
      }
      return value !== '';
    }).length;

    const requiredFields = this.fields.filter(f => f.required).length;
    const requiredFilledFields = this.fields.filter(f => {
      if (!f.required) return false;
      const value = f.element.value?.trim();
      if (f.type === 'checkbox' || f.type === 'radio') {
        return (f.element as HTMLInputElement).checked;
      }
      return value !== '';
    }).length;

    const completionPercentage = totalFields > 0
      ? Math.round((filledFields / totalFields) * 100)
      : 0;

    const isComplete = requiredFields > 0
      ? requiredFilledFields === requiredFields
      : filledFields === totalFields;

    return {
      totalFields,
      filledFields,
      requiredFields,
      requiredFilledFields,
      completionPercentage,
      isComplete,
    };
  }

  /**
   * Gets unfilled required fields
   */
  getUnfilledRequiredFields(): FormField[] {
    return this.fields.filter(f => {
      if (!f.required) return false;
      const value = f.element.value?.trim();
      if (f.type === 'checkbox' || f.type === 'radio') {
        return !(f.element as HTMLInputElement).checked;
      }
      return value === '';
    });
  }

  /**
   * Jumps to the first unfilled required field
   */
  goToFirstUnfilledRequired(): FormField | null {
    const unfilled = this.getUnfilledRequiredFields();
    if (unfilled.length === 0) return null;

    const index = this.fields.indexOf(unfilled[0]);
    if (index === -1) return null;

    this.currentFieldIndex = index;
    this.highlightField(unfilled[0]);
    return unfilled[0];
  }

  /**
   * Gets field by index
   */
  goToField(index: number): FormField | null {
    if (index < 0 || index >= this.fields.length) return null;

    this.currentFieldIndex = index;
    const field = this.fields[index];
    this.highlightField(field);
    return field;
  }

  /**
   * Gets current field index
   */
  getCurrentFieldIndex(): number {
    return this.currentFieldIndex;
  }
}
