import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logging';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface JwtPayload {
  userId: number;
  username: string;
  role: 'User' | 'GameMaster';
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}
export const authenticate = (
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Missing or invalid authorization header' 
      });
    }

    const token = authHeader.substring(7); 
    
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    req.user = payload;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireGameMaster = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'GameMaster') {
    return res.status(403).json({ 
      error: 'Forbidden: GameMaster role required' 
    });
  }
  next();
};

export const requireOwnerOrGameMaster = (getOwnerId: (req: AuthRequest) => number | Promise<number>) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
  if ((req as any).isServiceCall) {
      logger.info('Bypassing ownership check for service call');
      return next();
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (req.user.role === 'GameMaster') {
      return next();
    }

    try {
      const ownerId = await getOwnerId(req);
      logger.info({
        userId : req.user.userId ,
        ownerId
      })
      if (req.user.userId !== ownerId) {
        return res.status(403).json({ 
          error: 'Forbidden: You can only access your own resources' 
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};


export const authenticateService = (req: Request, res: Response, next: NextFunction) => {
  const serviceKey = req.headers['x-service-key'] as string;
  logger.info('Service auth check', {
    hasServiceKey: !!serviceKey,
    serviceKeyValue: serviceKey, 
    expectedKey: process.env.SERVICE_SECRET_KEY
  });
  
  if (serviceKey && serviceKey === process.env.SERVICE_SECRET_KEY) {
    logger.info('Service call authenticated');
    (req as any).isServiceCall = true;
    return next(); 
  }
  logger.info('Not a service call, continuing to regular auth');
  next();
};