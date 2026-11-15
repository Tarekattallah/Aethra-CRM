import { leadScope } from '../utils/access.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { Router } from 'express';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
import { UserRole } from '../models/User.js';
import { Customer } from '../models/Customer.js';
import { Lead, LeadStatus } from '../models/Lead.js';
import { escapeRegex, positiveInteger } from '../utils/input.js';
import { validateObjectId } from '../middlewares/validation.middleware.js';

const router = Router();
router.use(authenticate, requirePermission('customers:manage'));
router.param('id', validateObjectId);

router.get('/', async (req, res, next) => {
  try {
    const page = positiveInteger(req.query.page, 1, 1000000);
    const limit = positiveInteger(req.query.limit, 25);
    const search = escapeRegex(String(req.query.search || '').trim().slice(0, 200));
    const scope=leadScope((req as AuthRequest).user!);
    const visibleCustomers=await Lead.distinct('customerId',scope);
    const filter:any = search ? { $or: ['name', 'phone', 'phoneNormalized', 'email', 'companyName'].map(key => ({
      [key]: { $regex: search, $options: 'i' }
    })) } : {};
    filter._id={$in:visibleCustomers};
    const [customers, total] = await Promise.all([
      Customer.aggregate([
        { $match: filter }, { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (page - 1) * limit }, { $limit: limit },
        { $lookup: { from: Lead.collection.name, let: { customer: '$_id' }, pipeline: [
          { $match: { $and:[scope,{$expr:{$eq:['$customerId','$$customer']}}] } },
          {$group:{_id:{$ifNull:['$parentRequestId','$_id']},lastRequestAt:{$max:'$createdAt'},active:{$max:{$cond:[{$in:['$status',[LeadStatus.CONVERTED,LeadStatus.LOST]]},0,1]}}}},
          {$group:{_id:null,requestCount:{$sum:1},lastRequestAt:{$max:'$lastRequestAt'},activeRequestCount:{$sum:'$active'}}}
        ], as: 'summary' } },
        { $set: { requestCount: { $ifNull: [{ $first: '$summary.requestCount' }, 0] },
          activeRequestCount: { $ifNull: [{ $first: '$summary.activeRequestCount' }, 0] },
          lastRequestAt: { $first: '$summary.lastRequestAt' } } },
        { $unset: 'summary' }
      ]), Customer.countDocuments(filter)
    ]);
    res.json({ success: true, data: { customers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer || !await Lead.exists({$and:[leadScope((req as AuthRequest).user!),{customerId:customer._id}]})) { res.status(404).json({ success: false, message: 'ملف العميل غير موجود.' }); return; }
    res.json({ success: true, data: { customer } });
  } catch (error) { next(error); }
});

export default router;
