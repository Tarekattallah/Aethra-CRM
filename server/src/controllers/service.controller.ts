import { Request, Response } from 'express';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { Track } from '../models/Track.js';
import { localizeService, localizeDepartment } from '../services/catalog-localization.service.js';

export async function getActiveServices(req: Request, res: Response): Promise<void> {
  try {
    if (req.query.lang && !['ar', 'en'].includes(String(req.query.lang))) { res.status(400).json({ success: false, message: 'Unsupported language.' }); return; }
    const activeTracks = await Track.find({isActive: true}).distinct('_id');
    const [services, departments] = await Promise.all([
      ServiceCategory.find({ isActive: true, $or: [{trackId: null}, {trackId: {$in: activeTracks}}] }).select('name nameEn nameAr slug description descriptionEn descriptionAr trackId dynamicFormFields').lean(),
      Track.find({ isActive: true }).select('name nameEn nameAr slug color description descriptionEn descriptionAr').lean()
    ]);
    const language = req.query.lang as 'ar' | 'en' | undefined;
    res.json({
      success: true,
      data: { services: language ? services.map(service => localizeService(service, language)) : services,
        departments: language ? departments.map(department => localizeDepartment(department, language)) : departments }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب فئات الخدمات.' });
  }
}

