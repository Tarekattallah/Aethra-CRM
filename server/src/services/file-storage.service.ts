import mongoose from 'mongoose';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { Upload } from '../models/Upload.js';
import { uploadDir } from '../middlewares/upload.middleware.js';

function bucket() {
  if (!mongoose.connection.db) throw new Error('File storage requires a database connection');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'crmUploads' });
}

export async function persistUpload(file: Express.Multer.File) {
  if (process.env.UPLOAD_STORAGE !== 'mongodb') return { storage: 'local' as const };
  const destination = bucket().openUploadStream(file.filename);
  try {
    await pipeline(createReadStream(file.path), destination);
    return { storage: 'mongodb' as const, storageId: destination.id };
  } catch (error) {
    await destination.abort().catch(() => {});
    throw error;
  }
}

export async function deleteStoredUpload(storageId: mongoose.Types.ObjectId) {
  await bucket().delete(storageId);
}

export async function storedUploadInfo(filename: string) {
  const upload = await Upload.findOne({ filename }).lean();
  if (upload?.storage === 'mongodb' && upload.storageId) {
    const file = await bucket().find({ _id: upload.storageId }).next();
    return file ? { size: file.length, storageId: file._id } : null;
  }
  const file = await stat(path.join(uploadDir, filename)).catch(() => null);
  return file?.isFile() ? { size: file.size, storageId: undefined } : null;
}

const mediaTypes: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4'
};

// Authorization remains with the caller; only the selected portal logo is public.
export async function sendStoredUpload(req: Request, res: Response, filename: string, attachment = true) {
  const file = await storedUploadInfo(filename);
  if (!file) { res.status(404).json({ success: false, message: 'الملف غير موجود.' }); return; }
  let start = 0, end = file.size - 1;
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      res.status(416).setHeader('Content-Range', `bytes */${file.size}`); res.end(); return;
    }
    if (!match[1]) start = Math.max(0, file.size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= file.size) {
      res.status(416).setHeader('Content-Range', `bytes */${file.size}`); res.end(); return;
    }
    res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${file.size}`);
  }
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', Math.max(0, end - start + 1));
  res.setHeader('Content-Type', mediaTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', attachment ? 'private, no-store' : 'no-cache');
  res.setHeader('Content-Disposition', `${attachment ? 'attachment' : 'inline'}; filename="${filename}"`);
  if (req.method === 'HEAD' || file.size === 0) { res.end(); return; }
  const source = file.storageId
    ? bucket().openDownloadStream(file.storageId, { start, end: end + 1 })
    : createReadStream(path.join(uploadDir, filename), { start, end });
  await pipeline(source, res);
}
