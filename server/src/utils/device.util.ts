import { Request } from 'express';

export interface ParsedDeviceInfo {
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';
  deviceTypeAr: string;
  os: string;
  browser: string;
  ipAddress: string;
  userAgent: string;
  deviceSummary: string;
}

export function parseDeviceInfo(req: Request): ParsedDeviceInfo {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // IP Address extraction
  let ipAddress = 
    req.ip ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  // Normalize IPv6 localhost
  if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
    ipAddress = '127.0.0.1';
  }

  let deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN' = 'DESKTOP';
  let deviceTypeAr = 'كمبيوتر';
  let os = 'نظام غير معروف';
  let browser = 'متصفح غير معروف';

  // Device detection
  if (/iPad|tablet/i.test(userAgent)) {
    deviceType = 'TABLET';
    deviceTypeAr = 'تابلت / آيباد';
  } else if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    deviceType = 'MOBILE';
    deviceTypeAr = 'هاتف محمول';
  } else {
    deviceType = 'DESKTOP';
    deviceTypeAr = 'كمبيوتر مكتبي / لابتوب';
  }

  // OS Detection
  if (/Windows NT 10.0/i.test(userAgent)) os = 'Windows 10/11';
  else if (/Windows NT 6.3/i.test(userAgent)) os = 'Windows 8.1';
  else if (/Windows NT 6.1/i.test(userAgent)) os = 'Windows 7';
  else if (/Windows/i.test(userAgent)) os = 'Windows';
  else if (/iPhone OS ([\d_]+)/i.test(userAgent)) os = `iOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/iPad.*OS ([\d_]+)/i.test(userAgent)) os = `iPadOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/Mac OS X ([\d_]+)/i.test(userAgent)) os = `macOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/Android ([\d.]+)/i.test(userAgent)) os = `Android ${RegExp.$1}`;
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  // Browser Detection
  if (/Edg\/([\d.]+)/i.test(userAgent)) browser = `Edge ${RegExp.$1.split('.')[0]}`;
  else if (/Chrome\/([\d.]+)/i.test(userAgent)) browser = `Chrome ${RegExp.$1.split('.')[0]}`;
  else if (/Version\/([\d.]+).*Safari/i.test(userAgent)) browser = `Safari ${RegExp.$1.split('.')[0]}`;
  else if (/Firefox\/([\d.]+)/i.test(userAgent)) browser = `Firefox ${RegExp.$1.split('.')[0]}`;
  else if (/Opera|OPR\/([\d.]+)/i.test(userAgent)) browser = 'Opera';

  const icon = deviceType === 'MOBILE' ? '📱' : deviceType === 'TABLET' ? '📟' : '💻';
  const deviceSummary = `${icon} ${deviceTypeAr} (${os} • ${browser})`;

  return {
    deviceType,
    deviceTypeAr,
    os,
    browser,
    ipAddress,
    userAgent,
    deviceSummary
  };
}

