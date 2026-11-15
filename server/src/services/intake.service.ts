import { ServiceCategory } from '../models/ServiceCategory.js';
import { Track } from '../models/Track.js';

function invalid(message: string): never { throw Object.assign(new Error(message), { status: 400 }); }

export async function validateIntakeSelection(body: any, isStaff: boolean, retained?: {serviceIds:string[];departmentIds:string[]}) {
  const serviceIds = [...new Set<string>(body.serviceIds || (body.initialServiceId ? [body.initialServiceId] : []))];
  if (body.initialServiceId && !serviceIds.includes(body.initialServiceId)) invalid('الخدمة الأساسية غير موجودة ضمن الخدمات المختارة.');
  const services = await ServiceCategory.find({ _id: { $in: serviceIds }, $or:[{isActive:true},{_id:{$in:retained?.serviceIds||[]}}] });
  if (services.length !== serviceIds.length) invalid('إحدى الخدمات المختارة غير متاحة.');
  const departmentIds = [...new Set<string>([
    ...(body.departmentIds || []), ...(body.trackId ? [body.trackId] : []),
    ...services.flatMap(service => service.trackId ? [service.trackId.toString()] : [])
  ])];
  if (await Track.countDocuments({ _id: { $in: departmentIds }, $or:[{isActive:true},{_id:{$in:retained?.departmentIds||[]}}] }) !== departmentIds.length) invalid('إحدى الأقسام المختارة غير متاحة.');
  if (body.trackId && services.some(service => service.trackId && service.trackId.toString() !== body.trackId)) invalid('الخدمة لا تتبع القسم الأساسي المختار.');
  const serviceRequirements: Record<string, Record<string, any>> = {};
  let needsServiceDetails = false;
  for (const service of services) {
    const answers = body.serviceRequirements?.[service.id] || (serviceIds.length === 1 ? body.initialRequirements : {}) || {};
    const validated: Record<string, any> = {};
    for (const field of service.dynamicFormFields || []) {
      const value = answers[field.name];
      if (field.required && (value === undefined || value === null || value === '' || (field.type === 'checkbox' && value !== true))) {
        if (body.intakeVersion === 3) needsServiceDetails = true;
        else invalid(`الحقل مطلوب في ${service.name}: ${field.label}`);
      }
      if (value === undefined || value === '') continue;
      if ((field.type === 'select' && !field.options?.includes(value)) ||
        (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) ||
        (field.type === 'checkbox' && typeof value !== 'boolean') ||
        (['text', 'textarea'].includes(field.type) && (typeof value !== 'string' || value.length > 20000))) invalid(`قيمة غير صالحة في ${service.name}: ${field.label}`);
      validated[field.name] = value;
    }
    serviceRequirements[service.id] = validated;
  }
  const needsAssessment = Boolean(['QUICK','VOICE'].includes(body.intakeMode) || needsServiceDetails || departmentIds.length !== 1 || (!serviceIds.length && !body.trackId) ||
    ['NOT_SURE', 'OTHER'].includes(body.serviceSelection) || body.projectTypes?.includes('COMPLETE_SOLUTION'));
  return { serviceIds, departmentIds, serviceRequirements, needsAssessment,
    primaryServiceId: serviceIds[0], primaryTrackId: departmentIds.length === 1 ? departmentIds[0] : undefined };
}
