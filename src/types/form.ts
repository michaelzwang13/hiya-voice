export interface FormField {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  value: string;
  id: string;
  isAria?: boolean;
  ariaElements?: HTMLElement[];
  options?: string[];
}

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'url'
  | 'password'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'country'
  | 'company'
  | 'jobTitle'
  | 'unknown';

export interface FormInfo {
  fields: FormField[];
  formElement: HTMLFormElement | null;
  totalFields: number;
  requiredFields: number;
  filledFields: number;
}

export interface VoiceCommand {
  type: 'fill' | 'next' | 'previous' | 'submit' | 'insert' | 'review' | 'unknown';
  text: string;
  target?: string;
}
