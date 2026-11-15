import mongoose, { Schema, Document } from 'mongoose';

export enum RoutingMode {
  MANUAL = 'MANUAL',                          // توزيع يدوي بواسطة الأدمن فقط
  AUTO_ROUND_ROBIN = 'AUTO_ROUND_ROBIN',      // تناوب عادل تلقائي
  AUTO_SKILL_BASED = 'AUTO_SKILL_BASED',      // بناءً على تخصص الخدمة
  AUTO_LEAST_BUSY = 'AUTO_LEAST_BUSY'         // إسناد للأقل عملاء نشطين (الأول الفاضي)
}

export interface ISystemSettings extends Document {
  routingMode: RoutingMode;
  slaTimeoutMinutes: number;           // مهلة استجابة المهندس العامة بالدقائق (120 دقيقة)
  slaAcknowledgeMinutes: number;       // مهلة تأكيد استلام الطلب بالدقائق (افتراضياً 10 دقائق)
  slaContactMinutes: number;           // مهلة تأكيد أول تواصل مع العميل بالدقائق (افتراضياً 5 دقائق)
  autoReassignOnTimeout: boolean;       // هل يتم النقل التلقائي عند انتهاء المهلة؟
  skipBusyEngineers: boolean;          // تخطي المهندس إذا كان لديه عملاء جدد قيد الانتظار
  duplicateCheckFields: string[];      // ['phone', 'whatsapp', 'email', 'name']
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>({
  routingMode: { 
    type: String, 
    enum: Object.values(RoutingMode), 
    default: RoutingMode.AUTO_ROUND_ROBIN 
  },
  slaTimeoutMinutes: { type: Number, default: 120 }, // ساعتان افتراضياً
  slaAcknowledgeMinutes: { type: Number, default: 10 }, // 10 دقائق لتأكيد استلام الطلب
  slaContactMinutes: { type: Number, default: 5 }, // 5 دقائق لتأكيد أول تواصل
  autoReassignOnTimeout: { type: Boolean, default: true },
  skipBusyEngineers: { type: Boolean, default: true },
  duplicateCheckFields: { 
    type: [String], 
    default: ['phone', 'whatsapp', 'email'] 
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

export const SystemSettings = mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);

/**
 * جلب أو تهيئة إعدادات النظام الافتراضية
 */
export async function getSystemSettings(): Promise<ISystemSettings> {
  let settings = await SystemSettings.findOne().sort({_id: 1});
  if (!settings) {
    // A fixed initialization ID makes concurrent first requests converge on one document.
    const singletonId = new mongoose.Types.ObjectId('000000000000000000000001');
    try {
      settings = await SystemSettings.findByIdAndUpdate(singletonId, {$setOnInsert: {
        routingMode: RoutingMode.AUTO_ROUND_ROBIN,
        slaTimeoutMinutes: 120,
        slaAcknowledgeMinutes: 10,
        slaContactMinutes: 5,
        autoReassignOnTimeout: true,
        skipBusyEngineers: true,
        duplicateCheckFields: ['phone', 'whatsapp', 'email']
      }}, {upsert: true, new: true});
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      settings = await SystemSettings.findById(singletonId);
    }
  }
  if (!settings) throw new Error('System settings initialization failed');
  return settings;
}

