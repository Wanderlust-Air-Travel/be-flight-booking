import { TokenPayload } from '../auth/token-payload';

declare global {
  namespace Express {
    interface User extends TokenPayload {
      iat?: number;
      exp?: number;
    }
  }
}

export {};


