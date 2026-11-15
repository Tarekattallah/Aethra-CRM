import { Router, Request, Response } from 'express';
import { upload } from '../middlewares/upload.middleware.js';
import { randomUUID } from 'node:crypto';
import { Upload } from '../models/Upload.js';
import { hashToken } from '../services/upload.service.js';
import { AuthRequest, optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { open, unlink } from 'node:fs/promises';
import path from 'node:path';

const router = Router();

router.post('/', optionalAuthenticate, upload.single('file'), async (req: AuthRequest, res: Response, next): Promise<void> => {
  try {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'لم يتم إرفاق أي ملف.' });
    return;
  }

  const uploadToken = randomUUID();
  const handle = await open(req.file.path, 'r');
  const signature = Buffer.alloc(12);
  try { await handle.read(signature, 0, 12, 0); } finally { await handle.close(); }
  const hex = signature.toString('hex');
  const extension = path.extname(req.file.filename).toLowerCase();
  const signatures: Record<string, string[]> = { '.webm':['1a45dfa3'], '.ogg':['4f676753'], '.mp3':['494433','fffb','fff3','fff2'], '.wav':['52494646'], '.pdf': ['255044462d'], '.png': ['89504e470d0a1a0a'], '.jpg': ['ffd8ff'], '.jpeg': ['ffd8ff'], '.zip': ['504b0304','504b0506','504b0708'], '.docx': ['504b0304'], '.doc': ['d0cf11e0a1b11ae1'], '.rar': ['526172211a0700','526172211a0701'] };
  if (!(extension === '.m4a' ? signature.subarray(4,8).toString() === 'ftyp' : extension === '.wav' ? hex.startsWith('52494646') && signature.subarray(8,12).toString() === 'WAVE' : signatures[extension]?.some(prefix => hex.startsWith(prefix)))) {
    await unlink(req.file.path);
    res.status(400).json({success: false, message: 'محتوى الملف لا يطابق نوعه.'}); return;
  }
  await Upload.create({ filename: req.file.filename, originalName: req.file.originalname, ownerId: req.user?._id, tokenHash: hashToken(uploadToken) });
  const fileInfo = {
    uploadToken,
    filename: req.file.filename,
    originalName: req.file.originalname,
    url: `/uploads/${req.file.filename}`,
    size: req.file.size,
    mimeType: req.file.mimetype,
    uploadedAt: new Date()
  };

  res.status(200).json({
    success: true,
    message: 'تم رفع الملف بنجاح.',
    data: { file: fileInfo }
  });
  } catch (error) { next(error); }
});

export default router;

