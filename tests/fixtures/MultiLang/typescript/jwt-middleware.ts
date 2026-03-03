// TypeScript: Express JWT authentication middleware
// Paradigm: OOP, middleware chain, dependency injection
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export class JwtMiddleware {
  constructor(private readonly secret: string) {}

  authenticate = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, this.secret) as AuthPayload;
      req.user = payload;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'Token expired' });
      } else {
        res.status(401).json({ error: 'Invalid token' });
      }
    }
  };

  requireRole =
    (role: string) =>
    (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user?.roles.includes(role)) {
        res.status(403).json({ error: `Requires role: ${role}` });
        return;
      }
      next();
    };

  sign(payload: AuthPayload, expiresIn = '1h'): string {
    return jwt.sign(payload, this.secret, { expiresIn });
  }

  refresh(oldToken: string): string {
    const decoded = jwt.decode(oldToken) as AuthPayload;
    return this.sign({ userId: decoded.userId, email: decoded.email, roles: decoded.roles });
  }
}
