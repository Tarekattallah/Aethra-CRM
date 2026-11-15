import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserRole, isAdministrator } from '../models/User.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { logAudit } from '../services/audit.service.js';

import { getJwtSecret, jwtExpiresIn } from '../config.js';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.'
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .populate('specializations', 'name slug')
      .populate('trackId', 'name slug color')
      .populate('roleId', 'name slug permissions');

    if (!user || user.isDeleted) {
      res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة.'
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'هذا الحساب معطل حالياً من قبل الإدارة.'
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة.'
      });
      return;
    }

    // توليد التوكن
    const token = jwt.sign(
      { id: user._id, role: user.role, authVersion: user.authVersion || 0 },
      getJwtSecret(),
      { expiresIn: jwtExpiresIn, algorithm: 'HS256' }
    );

    res.cookie('crm_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api', maxAge: 86400000 });

    // توثيق عملية تسجيل الدخول وتتبع الجهاز
    await logAudit(req, {
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'LOGIN',
      actionTitle: 'تسجيل دخول للنظام',
      entityType: 'AUTH',
      entityId: user._id.toString(),
      details: `تم تسجيل الدخول بنجاح برتبة [${user.role}]`
    });

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          administrator:isAdministrator(user.role),
          ...(user.role===UserRole.SUPER_ADMIN?{canManageProtectedAccounts:true}:{}),
          roleId: user.roleId,
          trackId: user.trackId,
          permissions: user.permissions,
          permissionsSource: user.permissionsSource,
          phone: user.phone,
          maxDailyLeads: user.maxDailyLeads,
          specializations: user.specializations
        }
      }
    });
  } catch (error: any) {
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ غير متوقع أثناء تسجيل الدخول.'
    });
  }
}

export async function getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'غير مصرح.' });
      return;
    }

    const user = await User.findById(req.user._id)
      .select('-passwordHash')
      .populate('specializations', 'name slug')
      .populate('trackId', 'name slug color')
      .populate('roleId', 'name slug permissions');
    const token = req.headers.authorization?.slice(7);
    if (token) res.cookie('crm_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api', maxAge: 86400000 });

    res.json({
      success: true,
      data: { user: user ? { ...user.toObject(), id: user._id,administrator:isAdministrator(user.role),...(user.role===UserRole.SUPER_ADMIN?{canManageProtectedAccounts:true}:{}) } : null }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'تعذر جلب بيانات المستخدم الحالي.'
    });
  }
}
