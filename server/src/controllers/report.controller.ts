import { leadScope,isTrackBound } from '../utils/access.js';
import { ExecutionRoom } from '../models/ExecutionRoom.js';
import { Track } from '../models/Track.js';
import { Customer } from '../models/Customer.js';
import { receiverQuery } from '../utils/permissions.js';
import { startOfBusinessDay } from '../utils/business-time.js';
import { Response } from 'express';
import ExcelJS from 'exceljs';
import { Lead, LeadStatus } from '../models/Lead.js';
import { User, UserRole } from '../models/User.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * 1. جلب التحليلات الإجمالية وجدول عدالة المهندسين
 */
export async function getDashboardAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const scope=leadScope(req.user!);
    const count=(filter:any={})=>Lead.countDocuments({$and:[scope,filter]});
    const trackFilter=isTrackBound(req.user!)?{_id:req.user!.trackId||null}:{};
    const customerIds=await Lead.distinct('customerId',scope);
    const startOfToday = startOfBusinessDay();
    const [totals, revenues, sourceStats, workloads, engineers] = await Promise.all([
      Lead.aggregate([{$match:scope},{$group:{_id:{$ifNull:['$parentRequestId','$_id']},
        new:{$max:{$cond:[{$eq:['$status',LeadStatus.NEW]},1,0]}},
        converted:{$min:{$cond:[{$eq:['$status',LeadStatus.CONVERTED]},1,0]}},
        lost:{$min:{$cond:[{$eq:['$status',LeadStatus.LOST]},1,0]}},
        unassigned: {$max:{$cond:[{$and:[{$eq:[{$ifNull:['$assignedEngineerId',null]},null]},{$ne:['$isBundleParent',true]},{$ne:['$status','CONVERTED']},{$ne:['$status','LOST']}]},1,0]}},
        average:{$avg:'$responseTimeMinutes'}
      }},{$group:{_id:null,total:{$sum:1},new:{$sum:'$new'},converted:{$sum:'$converted'},lost:{$sum:'$lost'},unassigned:{$sum:'$unassigned'},average:{$avg:'$average'}}}]),
      Lead.aggregate([{$match:scope},{$match: {status: LeadStatus.CONVERTED}}, {$group: {_id: {$ifNull: ['$paymentReceipt.currency', '$currency']}, amount: {$sum: '$conversionValue'}}}]),
      Lead.aggregate([{$match:scope},
        {$group: {_id: {source: '$leadSource', currency: {$ifNull: ['$paymentReceipt.currency', '$currency']}}, count: {$sum: {$cond:[{$ifNull:['$parentRequestId',false]},0,1]}},
          converted: {$sum: {$cond: [{$eq: ['$status', LeadStatus.CONVERTED]}, 1, 0]}},
          revenue: {$sum: {$cond: [{$eq: ['$status', LeadStatus.CONVERTED]}, '$conversionValue', 0]}}}},
        {$group: {_id: '$_id.source', count: {$sum: '$count'}, converted: {$sum: '$converted'}, revenueByCurrency: {$push: {currency: '$_id.currency', amount: '$revenue'}}}},
        {$sort: {count: -1}}
      ]),
      Lead.aggregate([{$match:scope},{$group: {_id: '$assignedEngineerId', assignedTotal: {$sum: 1},
        newCount: {$sum: {$cond: [{$eq: ['$status', LeadStatus.NEW]}, 1, 0]}},
        convertedCount: {$sum: {$cond: [{$eq: ['$status', LeadStatus.CONVERTED]}, 1, 0]}},
        lostCount: {$sum: {$cond: [{$eq: ['$status', LeadStatus.LOST]}, 1, 0]}},
        todayCount: {$sum: {$cond: [{$gte: ['$assignedAt', startOfToday]}, 1, 0]}},
        avgResponseTimeMinutes: {$avg: '$responseTimeMinutes'}
      }}]),
      User.find({...receiverQuery, isDeleted: false,...(isTrackBound(req.user!)?{trackId:req.user!.trackId}:{} )}).select('-passwordHash').populate('specializations', 'name slug').lean()
    ]);
    const sourceCounts=await Lead.aggregate([{$match:scope},{$group:{_id:{source:'$leadSource',request:{$ifNull:['$parentRequestId','$_id']}},converted:{$min:{$cond:[{$eq:['$status','CONVERTED']},1,0]}}}},{$group:{_id:'$_id.source',count:{$sum:1},converted:{$sum:'$converted'}}}]);
    for(const source of sourceStats){const count=sourceCounts.find(item=>item._id===source._id);source.count=count?.count||0;source.converted=count?.converted||0;}
    const stat = totals[0] || {};
    const totalLeads = stat.total || 0;
    const newLeads = stat.new || 0;
    const convertedLeads = stat.converted || 0;
    const lostLeads = stat.lost || 0;
    const unassignedCount = stat.unassigned || 0;
    const revenueByCurrency = revenues.map(r => ({currency: r._id || 'USD', amount: r.amount}));
    const totalRevenue = revenues.length <= 1 ? revenues[0]?.amount || 0 : null;
    const avgResponseTime = Math.round(stat.average || 0);
    const overallConversionRate = totalLeads ? Math.round(convertedLeads / totalLeads * 100) : 0;
    const byEngineer = new Map(workloads.map(w => [String(w._id), w]));
    const engineerMatrix = engineers.map(eng => {
      const work = byEngineer.get(String(eng._id)) || {};
      return {id: eng._id, name: eng.name, email: eng.email, phone: eng.phone, isActive: eng.isActive,
        maxDailyLeads: eng.maxDailyLeads, specializations: eng.specializations,
        todayCount: work.todayCount || 0, assignedTotal: work.assignedTotal || 0, newCount: work.newCount || 0,
        convertedCount: work.convertedCount || 0, lostCount: work.lostCount || 0,
        conversionRate: work.assignedTotal ? Math.round(work.convertedCount / work.assignedTotal * 100) : 0,
        avgResponseTimeMinutes: Math.round(work.avgResponseTimeMinutes || 0)};
    });

    const open={isBundleParent:{$ne:true},status:{$nin:[LeadStatus.CONVERTED,LeadStatus.LOST]}};
    const now=new Date();
    const [customerCount,repeatCounts,pendingVoice,overdueFollowUps,overdueSla,agingRequests,tracks]=await Promise.all([
      Customer.countDocuments({_id:{$in:customerIds}}),Lead.aggregate([{$match:scope},{$match:{customerId:{$ne:null}}},{$group:{_id:{customer:'$customerId',request:{$ifNull:['$parentRequestId','$_id']}}}},{$group:{_id:'$_id.customer',requests:{$sum:1}}},{$match:{requests:{$gt:1}}},{$count:'count'}]),
      count({voiceReviewStatus:'PENDING'}),count({...open,nextFollowUpDate:{$lte:now}}),
      count({...open,assignedEngineerId:{$ne:null},$or:[{acknowledgedAt:{$exists:false},slaAcknowledgeDeadline:{$lte:now}},{acknowledgedAt:{$exists:true},contactConfirmedAt:{$exists:false},slaContactDeadline:{$lte:now}}]}),
      count({...open,createdAt:{$lte:new Date(Date.now()-7*86400000)}}),Track.find(trackFilter).select('name isActive').lean()
    ]);
    const trackHealth=await Promise.all(tracks.map(async track=>{
      const linked={isBundleParent:{$ne:true},$or:[{trackId:track._id},{departmentIds:track._id}]};
      const [total,active,unassigned,converted,receivers]=await Promise.all([count(linked),count({$and:[linked,open]}),count({$and:[linked,open,{assignedEngineerId:null}]}),count({$and:[linked,{status:LeadStatus.CONVERTED}]}),User.countDocuments({...receiverQuery,trackId:track._id,isActive:true,isDeleted:false})]);
      return {...track,total,active,unassigned,converted,receivers};
    }));
    const inbox={unclassified:await count({trackId:null,isBundleParent:{$ne:true},parentRequestId:null,status:{$nin:['CONVERTED','LOST']}}),multiTrack:await count({'departmentIds.1':{$exists:true},isBundleParent:{$ne:true},parentRequestId:null}),workOrders:await count({parentRequestId:{$ne:null}}),pendingTeams:await ExecutionRoom.countDocuments({status:'REQUESTED',...(isTrackBound(req.user!)?{trackId:req.user!.trackId}:{})})};
    res.json({
      success: true,
      data: {
        inbox,
        pipeline:await Lead.aggregate([{$match:scope},{$match:{isBundleParent:{$ne:true}}},{$group:{_id:'$status',count:{$sum:1}}},{$sort:{count:-1}}]),
        operational:{customers:customerCount,returningCustomers:repeatCounts[0]?.count||0,pendingVoice,overdueFollowUps,overdueSla,agingRequests,tracks:trackHealth},
        kpis: {
          totalLeads,
          newLeads,
          convertedLeads,
          lostLeads,
          unassignedCount,
          totalRevenue,
          revenueByCurrency,
          avgResponseTimeMinutes: avgResponseTime,
          overallConversionRate
        },
        sourceStats,
        engineerMatrix
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب إحصائيات الإدارة.' });
  }
}

/**
 * 2. تصدير تقرير العملاء إلى ملف Excel احترافي
 */
export async function exportLeadsToExcel(req: AuthRequest, res: Response): Promise<void> {
  try {
    const leads = await Lead.find(leadScope(req.user!))
      .populate({path:'assignedEngineerId',select:'name email',match:req.user?.role===UserRole.SUPER_ADMIN?{}:{role:{$ne:UserRole.SUPER_ADMIN}}})
      .populate('currentServiceId', 'name')
      .populate('initialServiceId', 'name')
      .populate('submittedByUserId', 'name')
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Aethra CRM';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('سجل العملاء والمبيعات', {
      views: [{ rightToLeft: true }] // اتجاه من اليمين لليسار للغة العربية
    });

    // تعريف الأعمدة
    worksheet.columns = [
      { header: 'كود العميل', key: 'leadCode', width: 14 },
      { header: 'اسم العميل', key: 'customerName', width: 22 },
      { header: 'رقم الهاتف', key: 'phone', width: 16 },
      { header: 'الدولة', key: 'country', width: 14 },
      { header: 'مصدر العميل', key: 'leadSource', width: 18 },
      { header: 'اسم الحملة', key: 'campaignName', width: 18 },
      { header: 'الخدمة المطلوبة', key: 'service', width: 25 },
      { header: 'المهندس المسؤول', key: 'engineer', width: 22 },
      { header: 'الحالة البيعية', key: 'status', width: 15 },
      { header: 'الأولوية', key: 'priority', width: 12 },
      { header: 'قيمة التعاقد', key: 'conversionValue', width: 15 },
      { header: 'سرعة أول رد (دقيقة)', key: 'responseTime', width: 18 },
      { header: 'تاريخ التسجيل', key: 'createdAt', width: 18 }
    ];

    // تنسيق ترويسة الجدول
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' } // Indigo 600
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 28;

    // إضافة البيانات
    leads.forEach((lead) => {
      const row = worksheet.addRow({
        leadCode: lead.leadCode,
        customerName: lead.customerName,
        phone: lead.phone,
        country: lead.country,
        leadSource: lead.leadSource,
        campaignName: lead.campaignName || '-',
        service: (lead.currentServiceId as any)?.name || (lead.initialServiceId as any)?.name || 'عام',
        engineer: (lead.assignedEngineerId as any)?.name || 'غير مسند (طابور الطوارئ)',
        status: lead.status,
        priority: lead.priority,
        conversionValue: lead.conversionValue ? `${lead.conversionValue} ${lead.paymentReceipt?.currency || lead.currency}` : '-',
        responseTime: lead.responseTimeMinutes !== undefined ? lead.responseTimeMinutes : '-',
        createdAt: new Date(lead.createdAt).toLocaleDateString('ar-EG')
      });

      row.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // إعداد الترويسات للتنزيل
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=leads-report-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('Export Excel Error:', error);
    res.status(500).json({ success: false, message: 'فشل تصدير ملف Excel.' });
  }
}
