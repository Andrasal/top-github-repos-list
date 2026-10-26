/** Error codes shared by every AI backend (SPEC §25.3). */
export type AiErrorCode =
  | 'bad_key' | 'no_access' | 'billing' | 'rate_limited' | 'overloaded' | 'network'
  | 'cancelled' | 'refused' | 'truncated' | 'invalid_request' | 'not_found' | 'too_large' | 'upstream_error'
  | 'no_tools';

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string, public text = '') { super(message); }
}
