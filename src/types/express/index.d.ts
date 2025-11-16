import { TokenPayload } from '../../domain/auth/types/token-payload';

declare global {
  namespace Express {
    interface User extends TokenPayload {
      iat?: number;
      exp?: number;
    }
  }
}

export {};


