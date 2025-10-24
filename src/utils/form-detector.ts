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

      // Try Google Forms pattern FIRST
      console.log('[Hiya Debug] Searching for radio group label');
      console.log('[Hiya Debug] Radio group element:', radioField);
      console.log('[Hiya Debug] Radio group className:', radioField.className);
      console.log('[Hiya Debug] Radio group parent:', radioField.parentElement);

      const googleFormsLabel = this.extractGoogleFormsLabelForGroup(radioGroup || elements[0]);
      if (googleFormsLabel) {
        label = googleFormsLabel;
        console.log('[Hiya Debug] Using Google Forms pattern:', label);
      }
      // Fallback to aria-label
      else if (radioField.hasAttribute("aria-label")) {
        const ariaLabelValue = radioField.getAttribute("aria-label");
        label = ariaLabelValue || label;
        console.log('[Hiya Debug] Using aria-label:', label);
      }
      // Fallback to aria-labelledby
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

      console.log('[Hiya Debug] Final label:', label);

      // Get the radiogroup's id
      id = radioField.id || id;

      // Check if required
      if (radioField.getAttribute("aria-required") === "true") {
        required = true;
      }
    }
    else {
      // No role="radiogroup" found, use first element
      radioField = elements[0] as HTMLElement;

      // Still try Google Forms pattern even without a radiogroup
      console.log('[Hiya Debug] No radiogroup found, trying Google Forms pattern from first element');
      const googleFormsLabel = this.extractGoogleFormsLabelForGroup(elements[0]);
      if (googleFormsLabel) {
        label = googleFormsLabel;
        console.log('[Hiya Debug] Using Google Forms pattern:', label);
      }
      console.log('[Hiya Debug] Final label:', label);
    }

    // Find the checked element
    const checkedElement = elements.find((el) => {
      return el.getAttribute("aria-checked") === "true";
    });

    // Get value from first span only
    let value = "";
    if (checkedElement) {
      const ariaLabel = checkedElement.getAttribute("aria-label");
      if (ariaLabel) {
        value = ariaLabel;
      } else {
        const firstSpan = checkedElement.querySelector('span');
        value = firstSpan?.textContent?.trim() || checkedElement.textContent?.trim() || "";
      }
    }

    // Extract all options - get text from first span only
    const options = elements.map(el => {
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;

      // Get text from first span only, not all nested content
      const firstSpan = el.querySelector('span');
      return firstSpan?.textContent?.trim() || el.textContent?.trim() || "";
    });

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

      // Try Google Forms pattern FIRST
      console.log('[Hiya Debug] Searching for checkbox group label');
      console.log('[Hiya Debug] Checkbox group element:', group);
      console.log('[Hiya Debug] Checkbox group className:', group.className);
      console.log('[Hiya Debug] Checkbox group parent:', group.parentElement);

      const googleFormsLabel = this.extractGoogleFormsLabelForGroup(group || elements[0]);
      if (googleFormsLabel) {
        label = googleFormsLabel;
        console.log('[Hiya Debug] Using Google Forms pattern:', label);
      }
      // Fallback to aria-label
      else if (group.hasAttribute('aria-label')) {
        const ariaLabelValue = group.getAttribute('aria-label');
        label = ariaLabelValue || label;
        console.log('[Hiya Debug] Using aria-label:', label);
      }
      // Fallback to aria-labelledby
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

      console.log('[Hiya Debug] Final label:', label);

      // Get the group's id
      id = group.id || id;

      // Check if required
      if (group.getAttribute('aria-required') === 'true') {
        required = true;
      }
    } else {
      // No role="group" found, use first element
      checkboxField = elements[0] as HTMLElement;

      // Still try Google Forms pattern even without a group
      console.log('[Hiya Debug] No group found for checkbox, trying Google Forms pattern from first element');
      const googleFormsLabel = this.extractGoogleFormsLabelForGroup(elements[0]);
      if (googleFormsLabel) {
        label = googleFormsLabel;
        console.log('[Hiya Debug] Using Google Forms pattern:', label);
      }
      console.log('[Hiya Debug] Final label:', label);
    }

    // Find all checked checkboxes
    const checkedElements = elements.filter(el =>
      el.getAttribute('aria-checked') === 'true'
    );

    // Value is a comma-separated list of checked items - get text from first span only
    const value = checkedElements.map(el => {
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;

      const firstSpan = el.querySelector('span');
      return firstSpan?.textContent?.trim() || el.textContent?.trim() || '';
    }).join(', ');

    // Extract all options - get text from first span only
    const options = elements.map(el => {
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;

      const firstSpan = el.querySelector('span');
      return firstSpan?.textContent?.trim() || el.textContent?.trim() || '';
    });

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
   * Finds label for text boxes by searching up for Google Forms container (jsmodel attribute)
   * then searching down for role="heading"
   */
  private extractGoogleFormsLabelForTextBox(element: Element): string | null {
    // Search up the tree for div with jsmodel attribute
    let current: Element | null = element;
    while (current && current !== document.body) {
      if (current.tagName === 'DIV' && current.hasAttribute('jsmodel')) {
        // Search down for role="heading"
        const headingElement = current.querySelector('[role="heading"]');
        if (headingElement?.textContent) {
          const label = headingElement.textContent.trim();
          return label;
        }
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * Finds label for radio/checkbox groups in Google Forms
   * Start from radiogroup/group, go up to first jsmodel, down to jscontroller, then first div with role=heading
   */
  private extractGoogleFormsLabelForGroup(element: Element): string | null {
    console.log('[Hiya Debug - Radio/Checkbox] ========== Starting Traversal ==========');
    console.log('[Hiya Debug - Radio/Checkbox] Starting element:', element);
    console.log('[Hiya Debug - Radio/Checkbox] Starting element role:', element.getAttribute('role'));
    console.log('[Hiya Debug - Radio/Checkbox] Starting element className:', element.className);

    // Search up the tree for div with jsmodel attribute
    let current: Element | null = element;
    let stepCount = 0;

    console.log('[Hiya Debug - Radio/Checkbox] ----- Going UP the tree -----');
    while (current && current !== document.body) {
      const isDiv = current.tagName === 'DIV';
      const hasJsmodel = current.hasAttribute('jsmodel');
      const jsmodelValue = current.getAttribute('jsmodel');

      console.log(`[Hiya Debug - Radio/Checkbox] Step ${stepCount}:`, {
        tagName: current.tagName,
        isDiv: isDiv,
        hasJsmodel: hasJsmodel,
        jsmodelValue: jsmodelValue,
        className: current.className.substring(0, 50)
      });

      if (isDiv && hasJsmodel) {
        console.log('[Hiya Debug - Radio/Checkbox] ✓ Found jsmodel div at step', stepCount);
        console.log('[Hiya Debug - Radio/Checkbox] ----- Going DOWN from jsmodel -----');

        // Go down to element with jscontroller
        const jscontrollerElement = current.querySelector('[jscontroller]');
        console.log('[Hiya Debug - Radio/Checkbox] jscontroller element:', jscontrollerElement);
        console.log('[Hiya Debug - Radio/Checkbox] jscontroller value:', jscontrollerElement?.getAttribute('jscontroller'));

        if (jscontrollerElement) {
          // Find first div child of jscontroller
          const firstDiv = jscontrollerElement.querySelector('div');
          console.log('[Hiya Debug - Radio/Checkbox] First div child of jscontroller:', firstDiv);
          console.log('[Hiya Debug - Radio/Checkbox] First div className:', firstDiv?.className);

          if (firstDiv) {
            // Search for role="heading" within this div
            const headingElement = firstDiv.querySelector('[role="heading"]');
            console.log('[Hiya Debug - Radio/Checkbox] Heading element in first div:', headingElement);

            if (headingElement) {
              // Get only the first span within the heading (label text, not the asterisk)
              const firstSpan = headingElement.querySelector('span');
              if (firstSpan?.textContent) {
                const label = firstSpan.textContent.trim();
                console.log('[Hiya Debug - Radio/Checkbox] ✓✓✓ SUCCESS! Found label from first span:', label);
                return label;
              } else if (headingElement.textContent) {
                // Fallback to full heading text if no span found
                const label = headingElement.textContent.trim();
                console.log('[Hiya Debug - Radio/Checkbox] ✓✓✓ SUCCESS! Found label from heading:', label);
                return label;
              } else {
                console.log('[Hiya Debug - Radio/Checkbox] ✗ No heading text found');
              }
            } else {
              console.log('[Hiya Debug - Radio/Checkbox] ✗ No heading element found');
            }
          } else {
            console.log('[Hiya Debug - Radio/Checkbox] ✗ No first div found under jscontroller');
          }
        } else {
          console.log('[Hiya Debug - Radio/Checkbox] ✗ No jscontroller found under jsmodel');
        }

        // If we found jsmodel but couldn't find the label, stop searching
        console.log('[Hiya Debug - Radio/Checkbox] Stopping search at first jsmodel');
        break;
      }

      current = current.parentElement;
      stepCount++;
    }

    console.log('[Hiya Debug - Radio/Checkbox] ✗✗✗ FAILED: Label not found after', stepCount, 'steps');
    return null;
  }

  /**
   * Extracts the label for a form field
   */
  private extractLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
    // Try multiple methods to find the label

    // 0. Google Forms pattern (jsmodel div -> role="heading")
    const googleFormsLabel = this.extractGoogleFormsLabelForTextBox(element);
    if (googleFormsLabel) {
      return this.cleanLabel(googleFormsLabel);
    }

    // 1. Associated <label> element
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label?.textContent) {
        const cleanedLabel = this.cleanLabel(label.textContent);
        return cleanedLabel;
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
        const cleanedLabel = this.cleanLabel(clone.textContent);
        return cleanedLabel;
      }
    }

    // 3. aria-label attribute
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      const cleanedLabel = this.cleanLabel(ariaLabel);
      return cleanedLabel;
    }

    // 4. aria-labelledby attribute
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement?.textContent) {
        const cleanedLabel = this.cleanLabel(labelElement.textContent);
        return cleanedLabel;
      }
    }

    // 5. aria-describedby attribute
    const ariaDescribedBy = element.getAttribute('aria-describedby');
    if (ariaDescribedBy) {
      const descElement = document.getElementById(ariaDescribedBy);
      if (descElement?.textContent) {
        const cleanedLabel = this.cleanLabel(descElement.textContent);
        return cleanedLabel;
      }
    }

    // 6. Previous sibling text (common in div-based forms)
    const previousSibling = element.previousElementSibling;
    if (previousSibling && (previousSibling.tagName === 'LABEL' || previousSibling.tagName === 'SPAN' || previousSibling.tagName === 'DIV')) {
      const text = previousSibling.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        const cleanedLabel = this.cleanLabel(text);
        return cleanedLabel;
      }
    }

    // 7. Preceding heading (h1-h6)
    let current = element.previousElementSibling;
    let attempts = 0;
    while (current && attempts < 3) {
      if (/^H[1-6]$/.test(current.tagName)) {
        const cleanedLabel = this.cleanLabel(current.textContent || '');
        return cleanedLabel;
      }
      current = current.previousElementSibling;
      attempts++;
    }

    // 8. Parent element's data attributes
    const parent = element.parentElement;
    if (parent) {
      const dataLabel = parent.getAttribute('data-label') || parent.getAttribute('data-field-label');
      if (dataLabel) {
        const cleanedLabel = this.cleanLabel(dataLabel);
        return cleanedLabel;
      }
    }

    // 9. Placeholder as fallback
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      const cleanedLabel = this.cleanLabel(placeholder);
      return cleanedLabel;
    }

    // 10. Title attribute
    const title = element.getAttribute('title');
    if (title) {
      const cleanedLabel = this.cleanLabel(title);
      return cleanedLabel;
    }

    // 11. Name attribute as last resort
    const name = element.getAttribute('name');
    if (name) {
      const cleanedLabel = this.cleanLabel(name.replace(/[_-]/g, ' '));
      return cleanedLabel;
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
