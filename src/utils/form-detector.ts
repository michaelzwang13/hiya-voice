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

    const ariaElements = Array.from(
      document.querySelectorAll('[role="radio"]')
    );

    const radioGroups: { [key: string]: Element[] } = {};

    ariaElements.forEach((element) => {
      const groupKey = element.className || 'default-group';
      if (!radioGroups[groupKey]) {
        radioGroups[groupKey] = [];
      }
      radioGroups[groupKey].push(element);
    })

    let index = 0;
    for (const groupArray of Object.values(radioGroups)) {
      const field = this.createAriaRadioField(groupArray, index);
      if (field) {
        this.fields.push(field);
        index++;
      }
    }

    // Find all ARIA checkboxes and group them
    const ariaCheckboxes = Array.from(
      document.querySelectorAll('[role="checkbox"]')
    );

    const checkboxGroups: { [key: string]: Element[] } = {};

    ariaCheckboxes.forEach((element) => {
      // Group by parent with role="group" or by className
      const groupParent = element.closest('[role="group"]');
      const groupKey = groupParent?.id ||
                       groupParent?.className ||
                       element.className ||
                       'default-checkbox-group';

      if (!checkboxGroups[groupKey]) {
        checkboxGroups[groupKey] = [];
      }
      checkboxGroups[groupKey].push(element);
    });

    for (const groupArray of Object.values(checkboxGroups)) {
      const field = this.createAriaCheckboxField(groupArray, index);
      if (field) {
        this.fields.push(field);
        index++;
      }
    }

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

  private createAriaRadioField(
    elements: Element[],
    index: number
  ): FormField | null {
    console.log('[Hiya Debug] createAriaRadioField called with', elements.length, 'elements');

    const hasVisibleElement = elements.some(el => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      return (style.display !== 'none' &&
              style.visibility != 'hidden' &&
              htmlEl.offsetParent !== null);
    })

    if (!hasVisibleElement) {
      console.log('[Hiya Debug] No visible elements in radio group, skipping');
      return null;
    }

    let radioField: HTMLElement;
    let label = 'Unlabeled radio group';
    let required = false;
    let id = `hiya-aria-radio-${index}`;

    console.log('[Hiya Debug] First element:', elements[0]);
    const radioGroup = elements[0].closest('[role="radiogroup"]');
    console.log('[Hiya Debug] Found radiogroup:', radioGroup);

    if (radioGroup) {
      radioField = radioGroup as HTMLElement;

      // Check for aria-label first
      const hasAriaLabel = radioField.hasAttribute("aria-label");
      const ariaLabelValue = radioField.getAttribute("aria-label");
      console.log('[Hiya Debug] aria-label check:', { hasAriaLabel, ariaLabelValue });

      if (hasAriaLabel) {
        label = ariaLabelValue || label;
        console.log('[Hiya Debug] Using aria-label:', label);
      }
      // Then check for aria-labelledby
      else if (radioField.hasAttribute("aria-labelledby")) {
        const labelId = radioField.getAttribute("aria-labelledby");
        console.log('[Hiya Debug] aria-labelledby:', labelId);
        if (labelId) {
          const labelElement = document.getElementById(labelId);
          console.log('[Hiya Debug] Label element found:', labelElement);
          label = labelElement?.textContent?.trim() || label;
          console.log('[Hiya Debug] Using aria-labelledby:', label);
        }
      }
      // Check for preceding heading
      else {
        console.log('[Hiya Debug] Searching for radio group label');
        console.log('[Hiya Debug] Radio group element:', radioField);
        console.log('[Hiya Debug] Radio group className:', radioField.className);
        console.log('[Hiya Debug] Radio group parent:', radioField.parentElement);

        // Try Google Forms pattern
        const googleFormsLabel = this.extractGoogleFormsLabel(group || elements[0]);
        if (googleFormsLabel) {
          label = googleFormsLabel;
          console.log('[Hiya Debug] Using Google Forms pattern:', label);
        }
        console.log('[Hiya Debug] Final label:', label);
      }

      // Get the radiogroup's id
      id = radioField.id || id;

      // Check if required
      if (radioField.getAttribute("aria-required") === "true") {
        required = true;
      }
    }
    else {
      radioField = elements[0] as HTMLElement;
    }

    // Find the checked element
    const checkedElement = elements.find((el) => {
      return el.getAttribute("aria-checked") === "true";
    });

    const value = checkedElement?.getAttribute("aria-label") ||
                  checkedElement?.textContent?.trim() ||
                  "";

    // Extract all options
    const options = elements.map(el =>
      el.getAttribute("aria-label") || el.textContent?.trim() || ""
    );

    return {
      element: radioField,
      type: 'radio',
      label,
      required,
      value,
      id,
      isAria: true,
      ariaElements: elements.map(el => el as HTMLElement),
      options,
    };
  }

  /**
   * Creates a FormField for an ARIA checkbox group
   */
  private createAriaCheckboxField(
    elements: Element[],
    index: number
  ): FormField | null {
    console.log('[Hiya Debug] createAriaCheckboxField called with', elements.length, 'elements');

    // Check if at least one element is visible
    const hasVisibleElement = elements.some(el => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      return (style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              htmlEl.offsetParent !== null);
    });

    if (!hasVisibleElement) {
      console.log('[Hiya Debug] No visible elements in checkbox group, skipping');
      return null;
    }

    let checkboxField: HTMLElement;
    let label = 'Unlabeled checkbox group';
    let required = false;
    let id = `hiya-aria-checkbox-${index}`;

    // Try to find parent group - go two levels up for checkboxes
    console.log('[Hiya Debug] First checkbox element:', elements[0]);
    const group = elements[0].closest('[role="group"]');
    console.log('[Hiya Debug] Found group:', group);

    if (group) {
      // For checkboxes, try going up one more level to get the outer container
      const outerContainer = group.parentElement;
      checkboxField = (outerContainer || group) as HTMLElement;

      // Check for aria-label first on the group
      const hasAriaLabel = group.hasAttribute('aria-label');
      const ariaLabelValue = group.getAttribute('aria-label');
      console.log('[Hiya Debug] aria-label check:', { hasAriaLabel, ariaLabelValue });

      if (hasAriaLabel) {
        label = ariaLabelValue || label;
        console.log('[Hiya Debug] Using aria-label:', label);
      }
      // Then check for aria-labelledby on the group
      else if (group.hasAttribute('aria-labelledby')) {
        const labelId = group.getAttribute('aria-labelledby');
        console.log('[Hiya Debug] aria-labelledby:', labelId);
        if (labelId) {
          const labelElement = document.getElementById(labelId);
          console.log('[Hiya Debug] Label element found:', labelElement);
          label = labelElement?.textContent?.trim() || label;
          console.log('[Hiya Debug] Using aria-labelledby:', label);
        }
      }
      // Check for preceding heading or label
      else {
        console.log('[Hiya Debug] Searching for checkbox group label');
        console.log('[Hiya Debug] Checkbox group element:', group);
        console.log('[Hiya Debug] Checkbox group className:', group.className);
        console.log('[Hiya Debug] Checkbox group parent:', group.parentElement);

        // Try Google Forms pattern
        const googleFormsLabel = this.extractGoogleFormsLabel(group || elements[0]);
        if (googleFormsLabel) {
          label = googleFormsLabel;
          console.log('[Hiya Debug] Using Google Forms pattern:', label);
        }
        console.log('[Hiya Debug] Final label:', label);
      }

      // Get the group's id
      id = group.id || id;

      // Check if required
      if (group.getAttribute('aria-required') === 'true') {
        required = true;
      }
    } else {
      checkboxField = elements[0] as HTMLElement;
    }

    // Find all checked checkboxes
    const checkedElements = elements.filter(el =>
      el.getAttribute('aria-checked') === 'true'
    );

    // Value is a comma-separated list of checked items
    const value = checkedElements.map(el =>
      el.getAttribute('aria-label') || el.textContent?.trim() || ''
    ).join(', ');

    // Extract all options
    const options = elements.map(el =>
      el.getAttribute('aria-label') || el.textContent?.trim() || ''
    );

    return {
      element: checkboxField,
      type: 'checkbox',
      label,
      required,
      value,
      id,
      isAria: true,
      ariaElements: elements.map(el => el as HTMLElement),
      options,
    };
  }

  /**
   * Finds label by searching up for Google Forms container (jsmodel attribute)
   * then searching down for role="heading"
   */
  private extractGoogleFormsLabel(element: Element): string | null {
    console.log('[Hiya Debug] Trying Google Forms pattern...');

    // Search up the tree for div with jsmodel attribute
    let current: Element | null = element;
    while (current && current !== document.body) {
      if (current.tagName === 'DIV' && current.hasAttribute('jsmodel')) {
        console.log('[Hiya Debug] Found jsmodel div:', current);

        // Search down for role="heading"
        const headingElement = current.querySelector('[role="heading"]');
        if (headingElement?.textContent) {
          const label = headingElement.textContent.trim();
          console.log('[Hiya Debug] Found Google Forms heading:', label);
          return label;
        }
      }
      current = current.parentElement;
    }

    console.log('[Hiya Debug] Google Forms pattern not found');
    return null;
  }

  /**
   * Extracts the label for a form field
   */
  private extractLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
    console.log('[Hiya Debug] Extracting label for element:', element);
    console.log('[Hiya Debug] Element details:', {
      tagName: element.tagName,
      type: (element as HTMLInputElement).type,
      id: element.id,
      name: element.name,
      className: element.className,
      placeholder: element.getAttribute('placeholder')
    });

    // Try multiple methods to find the label

    // 0. Google Forms pattern (jsmodel div -> role="heading")
    const googleFormsLabel = this.extractGoogleFormsLabel(element);
    if (googleFormsLabel) {
      return this.cleanLabel(googleFormsLabel);
    }

    // 1. Associated <label> element
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      console.log('[Hiya Debug] 1. Label[for] search for id', element.id, ':', label);
      if (label?.textContent) {
        const cleanedLabel = this.cleanLabel(label.textContent);
        console.log('[Hiya Debug] Using label[for]:', cleanedLabel);
        return cleanedLabel;
      }
    }

    // 2. Parent <label> element
    const parentLabel = element.closest('label');
    console.log('[Hiya Debug] 2. Parent label:', parentLabel);
    if (parentLabel) {
      // Clone and remove the input to get just the label text
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      const inputs = clone.querySelectorAll('input, textarea, select');
      inputs.forEach(input => input.remove());
      if (clone.textContent?.trim()) {
        const cleanedLabel = this.cleanLabel(clone.textContent);
        console.log('[Hiya Debug] Using parent label:', cleanedLabel);
        return cleanedLabel;
      }
    }

    // 3. aria-label attribute
    const ariaLabel = element.getAttribute('aria-label');
    console.log('[Hiya Debug] 3. aria-label:', ariaLabel);
    if (ariaLabel) {
      const cleanedLabel = this.cleanLabel(ariaLabel);
      console.log('[Hiya Debug] Using aria-label:', cleanedLabel);
      return cleanedLabel;
    }

    // 4. aria-labelledby attribute
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    console.log('[Hiya Debug] 4. aria-labelledby:', ariaLabelledBy);
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      console.log('[Hiya Debug] aria-labelledby element:', labelElement);
      if (labelElement?.textContent) {
        const cleanedLabel = this.cleanLabel(labelElement.textContent);
        console.log('[Hiya Debug] Using aria-labelledby:', cleanedLabel);
        return cleanedLabel;
      }
    }

    // 5. aria-describedby attribute
    const ariaDescribedBy = element.getAttribute('aria-describedby');
    console.log('[Hiya Debug] 5. aria-describedby:', ariaDescribedBy);
    if (ariaDescribedBy) {
      const descElement = document.getElementById(ariaDescribedBy);
      if (descElement?.textContent) {
        const cleanedLabel = this.cleanLabel(descElement.textContent);
        console.log('[Hiya Debug] Using aria-describedby:', cleanedLabel);
        return cleanedLabel;
      }
    }

    // 6. Previous sibling text (common in div-based forms)
    const previousSibling = element.previousElementSibling;
    console.log('[Hiya Debug] 6. Previous sibling:', previousSibling);
    if (previousSibling && (previousSibling.tagName === 'LABEL' || previousSibling.tagName === 'SPAN' || previousSibling.tagName === 'DIV')) {
      const text = previousSibling.textContent?.trim();
      console.log('[Hiya Debug] Previous sibling text:', text?.substring(0, 50));
      if (text && text.length > 0 && text.length < 100) {
        const cleanedLabel = this.cleanLabel(text);
        console.log('[Hiya Debug] Using previous sibling:', cleanedLabel);
        return cleanedLabel;
      }
    }

    // 7. Preceding heading (h1-h6)
    let current = element.previousElementSibling;
    let attempts = 0;
    console.log('[Hiya Debug] 7. Searching for preceding heading...');
    while (current && attempts < 3) {
      console.log(`[Hiya Debug] Sibling #${attempts}:`, current.tagName);
      if (/^H[1-6]$/.test(current.tagName)) {
        const cleanedLabel = this.cleanLabel(current.textContent || '');
        console.log('[Hiya Debug] Using heading:', cleanedLabel);
        return cleanedLabel;
      }
      current = current.previousElementSibling;
      attempts++;
    }

    // 8. Parent element's data attributes
    const parent = element.parentElement;
    console.log('[Hiya Debug] 8. Parent element:', parent);
    if (parent) {
      const dataLabel = parent.getAttribute('data-label') || parent.getAttribute('data-field-label');
      console.log('[Hiya Debug] Parent data-label:', dataLabel);
      if (dataLabel) {
        const cleanedLabel = this.cleanLabel(dataLabel);
        console.log('[Hiya Debug] Using data-label:', cleanedLabel);
        return cleanedLabel;
      }
    }

    // 9. Placeholder as fallback
    const placeholder = element.getAttribute('placeholder');
    console.log('[Hiya Debug] 9. Placeholder:', placeholder);
    if (placeholder) {
      const cleanedLabel = this.cleanLabel(placeholder);
      console.log('[Hiya Debug] Using placeholder:', cleanedLabel);
      return cleanedLabel;
    }

    // 10. Title attribute
    const title = element.getAttribute('title');
    console.log('[Hiya Debug] 10. Title:', title);
    if (title) {
      const cleanedLabel = this.cleanLabel(title);
      console.log('[Hiya Debug] Using title:', cleanedLabel);
      return cleanedLabel;
    }

    // 11. Name attribute as last resort
    const name = element.getAttribute('name');
    console.log('[Hiya Debug] 11. Name:', name);
    if (name) {
      const cleanedLabel = this.cleanLabel(name.replace(/[_-]/g, ' '));
      console.log('[Hiya Debug] Using name:', cleanedLabel);
      return cleanedLabel;
    }

    console.log('[Hiya Debug] No label found, using default');
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
      // Also remove highlight from individual ARIA elements
      if (f.ariaElements) {
        f.ariaElements.forEach(el => el.classList.remove(this.HIGHLIGHT_CLASS));
      }
    });

    // For ARIA radio/checkbox groups, highlight the parent container
    if (field.isAria && (field.type === 'radio' || field.type === 'checkbox')) {
      // Highlight the parent group element (radiogroup or group)
      field.element.classList.add(this.HIGHLIGHT_CLASS);
    } else {
      // For regular fields, highlight the field itself
      field.element.classList.add(this.HIGHLIGHT_CLASS);
    }

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

    // Handle ARIA elements differently
    if (field.isAria) {
      // For ARIA radios, set aria-checked
      if (field.type === 'radio' && field.ariaElements) {
        // Find the radio option that matches the value
        field.ariaElements.forEach(el => {
          const optionLabel = el.getAttribute('aria-label') || el.textContent?.trim() || '';
          if (optionLabel === value) {
            el.setAttribute('aria-checked', 'true');
          } else {
            el.setAttribute('aria-checked', 'false');
          }
        });
      }
      // For ARIA checkbox groups, toggle individual checkboxes
      else if (field.type === 'checkbox' && field.ariaElements) {
        field.ariaElements.forEach(el => {
          const optionLabel = el.getAttribute('aria-label') || el.textContent?.trim() || '';
          // Value can be comma-separated list of checked items
          const checkedItems = value.split(',').map(v => v.trim());
          if (checkedItems.includes(optionLabel)) {
            el.setAttribute('aria-checked', 'true');
          } else {
            el.setAttribute('aria-checked', 'false');
          }
        });
      }
      field.value = value;
    } else {
      // Native form elements
      if ('value' in field.element) {
        field.element.value = value;
        field.value = value;
      }
    }

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
      if (f.isAria) {
        // For ARIA elements, use the stored value
        return f.value.trim() !== '';
      }
      if ('value' in f.element) {
        const value = f.element.value?.trim();
        if (f.type === 'checkbox' || f.type === 'radio') {
          return (f.element as HTMLInputElement).checked;
        }
        return value !== '';
      }
      return false;
    }).length;

    const requiredFields = this.fields.filter(f => f.required).length;
    const requiredFilledFields = this.fields.filter(f => {
      if (!f.required) return false;
      if (f.isAria) {
        // For ARIA elements, use the stored value
        return f.value.trim() !== '';
      }
      if ('value' in f.element) {
        const value = f.element.value?.trim();
        if (f.type === 'checkbox' || f.type === 'radio') {
          return (f.element as HTMLInputElement).checked;
        }
        return value !== '';
      }
      return false;
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
      if (f.isAria) {
        // For ARIA elements, use the stored value
        return f.value.trim() === '';
      }
      if ('value' in f.element) {
        const value = f.element.value?.trim();
        if (f.type === 'checkbox' || f.type === 'radio') {
          return !(f.element as HTMLInputElement).checked;
        }
        return value === '';
      }
      return true;
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
