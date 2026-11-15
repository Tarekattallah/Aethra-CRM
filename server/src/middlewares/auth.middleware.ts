import { installAccountPrivacy } from '../services/account-privacy.service.js';
import { hasPermission } from '../utils/permissions.js';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser, UserRole, isAdministrator } from '../models/User.js';

export interface AuthRequest extends Request {
  user?: IUser;
}

// Cookies are used only by browser GETs (downloads/SSE), never as write authorization.
export function browserSession(req: Request, _res: Response, next: NextFunction): void {
  if (!req.headers.authorization) {
    const cookie = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('crm_session='));
    if (cookie) {
      try { req.headers.authorization = `Bearer ${decodeURIComponent(cookie.slice('crm_session='.length))}`; } catch { /* invalid cookie */ }
    }
  }
  next();
}

export function optionalAuthenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.headers.authorization) { void authenticate(req, res, next); } else next();
}

import { getJwtSecret, jwtExpiresIn } from '../config.js';

/**
 * ميدلوير للتحقق من صحة توكن الـ JWT واستخراج بيانات المستخدم
 */
export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'غير مصرح: يرجى تسجيل الدخول وإرفاق رمز الدخول (Token).'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as { id: string; role: string; authVersion?: number };
    if (!decoded.id || !/^[a-f\d]{24}$/i.test(decoded.id)) throw new Error('Invalid subject');
    
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user || user.isDeleted) {
      res.status(401).json({
        success: false,
        message: 'الحساب غير موجود أو تم حذفه.'
      });
      return;
    }
    if ((decoded.authVersion ?? 0) !== (user.authVersion || 0)) {
      res.status(401).json({success: false, message: 'انتهت الجلسة بعد تحديث بيانات الحساب؛ سجل الدخول مجدداً.'}); return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'الحساب معطل حالياً. يرجى مراجعة إدارة النظام.',
        code: 'ACCOUNT_DISABLED'
      });
      return;
    }

    req.user = user;
    await installAccountPrivacy(user,res);
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'رمز الدخول غير صالح أو منتهي الصلاحية.'
    });
    return;
  }
}

/**
 * ميدلوير للتحقق من رتبة المستخدم (Role-Based Access Control)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'غير مصرح.' });
      return;
    }

    if (req.user.role === UserRole.SUPER_ADMIN) {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        success: false,
        message: 'عفواً، ليس لديك الصلاحية الكافية للوصول لهذا الإجراء.'
      });
      return;
    }

    next();
  };
}

/**
 * ميدلوير للتحقق من صلاحية دقيقة محددة (Granular Permission)
 * يمر الأدمن تلقائياً، أو من يحمل الصلاحية صراحة
 */
export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'غير مصرح.' });
      return;
    }

    if (!hasPermission(req.user, permission)) {
      res.status(403).json({
        success: false,
        message: `يتطلب هذا الإجراء صلاحية: (${permission}).`
      });
      return;
    }

    next();
  };
}


export function requireAnyPermission(...permissions:string[]) {
  return (req:AuthRequest,res:Response,next:NextFunction)=>{if(permissions.some(permission=>hasPermission(req.user,permission)))next();else res.status(403).json({success:false,message:'هذا الإجراء غير متاح لحسابك.'});};
}
