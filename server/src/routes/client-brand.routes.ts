import {Router} from 'express';
import path from 'node:path';
import {stat} from 'node:fs/promises';
import {z} from 'zod';
import {ClientPortalBrand} from '../models/ClientPortalBrand.js';
import {Upload} from '../models/Upload.js';
import {UserRole} from '../models/User.js';
import {authenticate,requireRole,AuthRequest} from '../middlewares/auth.middleware.js';
import {validateBody} from '../middlewares/validation.middleware.js';
import {uploadDir} from '../middlewares/upload.middleware.js';
import {serializeLeadMutation} from '../services/mutation-queue.service.js';
import {logAudit} from '../services/audit.service.js';

export const DEFAULT_CLIENT_BRAND={companyName:'Digency',whatsapp:'201116247717',revision:0,logoFilename:null};
const dto=(value:any)=>{const brand=value||DEFAULT_CLIENT_BRAND;return {companyName:brand.companyName,whatsapp:brand.whatsapp,revision:brand.revision,logoFilename:brand.logoFilename||null,logoUrl:brand.logoFilename?`/api/public/branding/logo?v=${brand.revision}`:'/brand/digency/logo.png'};};
const router=Router();
router.get('/public/branding',async(_req,res,next)=>{try{res.setHeader('Cache-Control','no-store');res.json({success:true,data:{brand:dto(await ClientPortalBrand.findOne({key:'client'}).lean())}});}catch(e){next(e);}});
router.get('/public/branding/logo',async(_req,res,next)=>{try{const brand=await ClientPortalBrand.findOne({key:'client'}).lean();if(!brand?.logoFilename){res.redirect('/brand/digency/logo.png');return;}res.setHeader('Cache-Control','no-cache');res.sendFile(path.join(uploadDir,brand.logoFilename),error=>{if(error)next(error);});}catch(e){next(e);}});
const schema=z.object({companyName:z.string().trim().min(1).max(100),whatsapp:z.string().regex(/^[1-9]\d{6,14}$/),logoFilename:z.string().regex(/^[\w-]+\.(png|jpg|jpeg)$/i).nullable().optional(),revision:z.number().int().nonnegative()});
router.put('/manage/client-brand',authenticate,requireRole(UserRole.SUPER_ADMIN),validateBody(schema),serializeLeadMutation(async(req:AuthRequest,res)=>{
  const before=await ClientPortalBrand.findOne({key:'client'});const {companyName,whatsapp,logoFilename,revision}=req.body;
  if(revision!==(before?.revision||0)){res.status(409).json({success:false,message:'الهوية اتعدلت من جلسة أخرى. حدّث الصفحة قبل الحفظ.'});return;}
  if(logoFilename&&logoFilename!==before?.logoFilename){
    if(!await Upload.exists({filename:logoFilename,ownerId:req.user!._id})){res.status(403).json({success:false,message:'ارفع صورة اللوجو من حسابك أولًا.'});return;}
    const file=await stat(path.join(uploadDir,logoFilename)).catch(()=>null);if(!file||file.size>5*1024*1024){res.status(400).json({success:false,message:'اختر صورة PNG أو JPG حتى 5 ميجابايت.'});return;}
  }
  const oldValues=before?.toObject()||DEFAULT_CLIENT_BRAND;
  const nextLogo=logoFilename===undefined?before?.logoFilename:logoFilename||undefined;
  const brand=before||new ClientPortalBrand({key:'client'});brand.companyName=companyName;brand.whatsapp=whatsapp;brand.logoFilename=nextLogo;brand.revision=revision+1;await brand.save();
  await logAudit(req,{action:'CLIENT_BRAND_UPDATED',actionTitle:'تعديل هوية صفحة استقبال العملاء',entityType:'SETTINGS',entityId:brand.id,oldValues,newValues:{companyName,logoFilename:nextLogo,whatsapp}});
  res.json({success:true,data:{brand:dto(brand)}});
}));
export default router;
