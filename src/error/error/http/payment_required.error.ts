import { HTTPError } from './http_error.error';

export class PaymentRequired extends Error implements HTTPError {
  get httpCode() {
    return 402;
  }
}