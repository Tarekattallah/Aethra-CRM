import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lead_management_db';

export async function connectDB(): Promise<typeof mongoose> {
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in production');
    if (process.env.UPLOAD_STORAGE && !['local', 'mongodb'].includes(process.env.UPLOAD_STORAGE)) throw new Error('Invalid UPLOAD_STORAGE');
    mongoose.set('strictQuery', true);
    
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    throw error;
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB Disconnected.');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB Reconnected.');
});

