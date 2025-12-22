import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

export interface ExtendedRequest extends Request {
  userDetails?: {
    userId: number;
    role: string;
  };
  ledgerMasterAccess?: {
    companyId: number;
    ledgerMasterAccessId: number;
  };
}

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  use(req: ExtendedRequest, res: Response, next: NextFunction) {
    // Skip auth for public endpoints
    const publicPaths = ['/auth/login', '/auth/seed-test-data', '/auth/seed-customers-orders'];
    // Allow all pincode lookup requests without auth
    if (publicPaths.some(path => req.path === path) || req.path.startsWith('/pincodes/lookup')) {
      return next();
    }

    const auth = req.headers['authorization'];
    if (!auth) throw new UnauthorizedException('Missing Authorization header');

    const parts = String(auth).split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer')
      throw new UnauthorizedException('Invalid Authorization header');

    const token = parts[1];
    try {
      const secret = process.env.JWT_SECRET || 'replace_with_strong_secret';
      const payload = jwt.verify(token, secret) as any;
      req.userDetails = { userId: payload.id, role: payload.role };
      next();
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
