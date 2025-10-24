export interface Message {
  type: MessageType;
  payload?: any;
}

export type MessageType =
  | 'DETECT_FORMS'
  | 'FORMS_DETECTED'
  | 'TOGGLE_VOICE'
  | 'VOICE_STARTED'
  | 'VOICE_STOPPED'
  | 'FILL_FIELD'
  | 'NEXT_FIELD'
  | 'PREVIOUS_FIELD'
  | 'GOTO_UNFILLED'
  | 'GET_FORM_STATE'
  | 'FORM_STATE_RESPONSE'
  | 'ENABLE_EXTENSION'
  | 'DISABLE_EXTENSION';
