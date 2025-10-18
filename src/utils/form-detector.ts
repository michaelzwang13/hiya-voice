import type { FormField, FormInfo, FieldType } from '../types/form';

export class FormDetector {
  private fields: FormField[] = [];
  private currentFieldIndex = -1;

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
        return label.textContent.trim();
      }
    }

    // 2. Parent <label> element
    const parentLabel = element.closest('label');
    if (parentLabel?.textContent) {
      return parentLabel.textContent.trim();
    }

    // 3. aria-label attribute
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    // 4. aria-labelledby attribute
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement?.textContent) {
        return labelElement.textContent.trim();
      }
    }

    // 5. Placeholder as fallback
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      return placeholder.trim();
    }

    // 6. Name attribute as last resort
    const name = element.getAttribute('name');
    if (name) {
      return name.replace(/[_-]/g, ' ').trim();
    }

    return 'Unlabeled field';
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

    // Infer type from attributes
    const combined = `${name} ${id} ${placeholder}`.toLowerCase();

    if (combined.includes('email')) return 'email';
    if (combined.includes('phone') || combined.includes('tel')) return 'phone';
    if (combined.includes('url') || combined.includes('website')) return 'url';
    if (combined.includes('date') || combined.includes('birth')) return 'date';

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
    field.element.focus();
    field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
    field.element.focus();
    field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return field;
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
}
