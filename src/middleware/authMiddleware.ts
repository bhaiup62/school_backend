import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: {
    userId: string
    admissionNumber: string
    role: string
  }
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    let token: string | undefined

    // Check Authorization header first
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    }

    // Fall back to query param (for SSE - EventSource can't set headers)
    if (!token && req.query.token) {
      token = req.query.token as string
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. No token provided.',
      })
      return
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any

    req.user = {
      userId: decoded.userId,
      admissionNumber: decoded.admissionNumber,
      role: decoded.role,
    }

    next()
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized. Invalid or expired token.',
    })
  }
}

export const authorizeRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Only ${roles.join(', ')} can access this.`,
      })
      return
    }
    next()
  }
}