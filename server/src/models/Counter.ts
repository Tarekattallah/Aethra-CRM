import mongoose, { Schema } from 'mongoose';
import { Lead } from './Lead.js';

export interface ICounter {
  _id: string; // e.g. "leadCode"
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 10000 }
});

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);
const synchronizedCounters = new Set<string>();

/**
 * دالة ذرية لتوليد الكود المتسلسل التالي بأمان تام ضد التزامن (Thread-Safe Atomic Increment)
 */
export async function getNextSequence(sequenceName: string): Promise<number> {
  const key = `${mongoose.connection.name}:${sequenceName}`;
  if (!synchronizedCounters.has(key) || !await Counter.exists({ _id: sequenceName })) {
    let initial = 10000;
    if (sequenceName === 'leadCode') {
      const [highest] = await Lead.aggregate([
        { $match: { leadCode: /^#LD-\d+$/ } },
        { $project: { number: { $convert: { input: { $substrBytes: ['$leadCode', 4, -1] }, to: 'double', onError: 0 } } } },
        { $group: { _id: null, number: { $max: '$number' } } }
      ]);
      initial = Math.max(initial, highest?.number || 0);
    }
    try { await Counter.updateOne({ _id: sequenceName }, { $max: { seq: initial } }, { upsert: true, setDefaultsOnInsert: false }); }
    catch (error: any) {
      if (error.code !== 11000) throw error;
      await Counter.updateOne({ _id: sequenceName }, { $max: { seq: initial } });
    }
    synchronizedCounters.add(key);
  }
  const counter = await Counter.findByIdAndUpdate(sequenceName, { $inc: { seq: 1 } }, { new: true });
  if (!counter) throw new Error('Counter unavailable');
  return counter.seq;
}
