import { receiverQuery,hasPermission } from '../utils/permissions.js';
import { logAudit } from '../services/audit.service.js';
import { idOf,isTrackBound,leadScope } from '../utils/access.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
import { Response } from 'express';
import { Track } from '../models/Track.js';
import { User, UserRole } from '../models/User.js';
import { Lead } from '../models/Lead.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * 1. جلب قائمة كافة التراكات مع التيم ليدر وعدد المهندسين والعملاء
 */
export async function getTracks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tracks = await Track.find(isTrackBound(req.user!)?{_id:req.user!.trackId||null}:{})
      .populate('teamLeaderId', 'name email phone role')
      .sort({ createdAt: 1 })
      .lean();

    // إحصائيات سريعة لكل تراك
    const tracksWithStats = await Promise.all(
      tracks.map(async (track) => {
        const [engineersCount, leadsCount] = await Promise.all([
          User.countDocuments({ trackId: track._id, ...receiverQuery, isDeleted: false, isActive: true }),
          Lead.countDocuments({$and:[leadScope(req.user!),{trackId:track._id,isBundleParent:{$ne:true}}]})
        ]);

        return {
          ...track,
          engineersCount,
          leadsCount
        };
      })
    );

    res.json({
      success: true,
      data: { tracks: tracksWithStats }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب التراكات.' });
  }
}

/**
 * 2. إنشاء تراك جديد
 */
export async function createTrack(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, nameEn, descriptionEn, slug, description, teamLeaderId, color } = req.body;

    if (!name || !slug) {
      res.status(400).json({ success: false, message: 'يرجى إدخال اسم التراك والرمز التعريفي (Slug).' });
      return;
    }

    if (teamLeaderId) {
      const leader = await User.findOne({_id: teamLeaderId, isActive: true, isDeleted: false});
      if (!leader || ['ADMIN','SUPER_ADMIN'].includes(leader.role) || !hasPermission(leader,'execution:manage') || (leader.trackId && leader.trackId.toString() !== '')) {
        res.status(400).json({success: false, message: 'اختر تيم ليدر نشطاً غير مرتبط بتراك آخر.'}); return;
      }
    }
    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, '-');
    const existing = await Track.findOne({ slug: cleanSlug });
    if (existing) {
      res.status(400).json({ success: false, message: 'رمز التراك (Slug) موجود مسبقاً.' });
      return;
    }

    const track = await Track.create({
      name: name.trim(), nameAr:name.trim(), nameEn, descriptionEn,
      slug: cleanSlug,
      description: description?.trim(),
      teamLeaderId: teamLeaderId || null,
      color: color || '#1AD6F7',
      isActive: true
    });

    // إذا تم تعيين تيم ليدر، نحدّث بياناته ليرتبط بالتراك
    if (teamLeaderId) {
      await User.findByIdAndUpdate(teamLeaderId, {
        trackId: track._id
      });
    }

    res.status(201).json({
      success: true,
      message: `تم إنشاء تراك [${track.name}] بنجاح.`,
      data: { track }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل إنشاء التراك.' });
  }
}

/**
 * 3. تعديل تراك وبيانات التيم ليدر
 */
export async function updateTrack(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, nameEn, descriptionEn, description, teamLeaderId, color, isActive } = req.body;

    const track = await Track.findById(id);
    if (!track) {
      res.status(404).json({ success: false, message: 'التراك غير موجود.' });
      return;
    }

    if (teamLeaderId) {
      const leader = await User.findOne({_id: teamLeaderId, isActive: true, isDeleted: false});
      if (!leader || ['ADMIN','SUPER_ADMIN'].includes(leader.role) || !hasPermission(leader,'execution:manage') || (leader.trackId && leader.trackId.toString() !== id)) {
        res.status(400).json({success: false, message: 'اختر تيم ليدر نشطاً غير مرتبط بتراك آخر.'}); return;
      }
    }
    if (name) {track.name = name.trim();track.nameAr=name.trim();}
    if(nameEn!==undefined)track.nameEn=nameEn;
    if(descriptionEn!==undefined)track.descriptionEn=descriptionEn;
    if (description !== undefined) track.description = description.trim();
    if (color) track.color = color;
    if (isActive !== undefined) track.isActive = Boolean(isActive);

    if (teamLeaderId !== undefined && idOf(track.teamLeaderId) !== teamLeaderId) {
      if (track.teamLeaderId) await User.updateOne({_id: track.teamLeaderId, trackId: track._id}, {$unset: {trackId: 1}});
      track.teamLeaderId = teamLeaderId ? teamLeaderId : undefined;
      if (teamLeaderId) {
        await User.findByIdAndUpdate(teamLeaderId, {
          trackId: track._id
        });
      }
    }

    await track.save();
    await logAudit(req,{action:'TRACK_UPDATED',actionTitle:'تعديل تراك وتفاصيل الفريق',entityType:'SETTINGS',entityId:track.id});

    const updated = await Track.findById(id).populate('teamLeaderId', 'name email phone');

    res.json({
      success: true,
      message: 'تم تحديث التراك بنجاح.',
      data: { track: updated }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تحديث التراك.' });
  }
}

/**
 * 4. حذف أو إيقاف تراك
 */
export async function deleteTrack(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // التحقق من وجود عملاء مرتبطين
    const leadsLinked = await Lead.countDocuments({$or:[{trackId:id},{departmentIds:id}]});
    if (leadsLinked > 0 || await User.exists({trackId: id}) || await ServiceCategory.exists({trackId: id})) {
      // إيقاف التراك فقط بدلاً من الحذف لتجنب ضياع البيانات
      await Track.findByIdAndUpdate(id, { isActive: false });
      res.json({
        success: true,
        message: 'تم تعطيل التراك لوجود عملاء مرتبطين به، حفاظاً على سجل البيانات.'
      });
      return;
    }

    await Track.findByIdAndDelete(id);
    res.json({
      success: true,
      message: 'تم حذف التراك بنجاح.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل حذف التراك.' });
  }
}

