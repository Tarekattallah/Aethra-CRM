import 'dotenv/config';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { connectDB } from './db.js';
import { User, UserRole } from './models/User.js';
import { bootstrapSuperAdmin } from './services/superadmin.service.js';

async function bootstrap(): Promise<void> {
  const args = process.argv.slice(2);
  const email = args[args.indexOf('--email') + 1]?.trim().toLowerCase();
  if (!args.includes('--email') || !email || !args.includes('--confirm')) {
    throw new Error('Usage: npm run bootstrap:superadmin -- --email owner@example.com --confirm [--create]');
  }
  await connectDB();
  const existing = await User.findOne({email}).select('_id');
  const password = !existing && args.includes('--create') ? randomBytes(24).toString('base64url') : undefined;
  const credentialsFile = path.resolve('.env.superadmin.local');
  if (password) await writeFile(credentialsFile, `EMAIL=${email}\nPASSWORD=${password}\nROLE=SUPER_ADMIN\n`, {flag: 'wx', mode: 0o600});
  try {
    const result = await bootstrapSuperAdmin(email, password);
    console.log(`SuperAdmin enabled for ${result.user.email}. Full access to every site permission.`);
    if (result.created) console.log(`Credentials saved locally in ${credentialsFile}.`);
    else console.log('Existing password unchanged.');
  } catch (error) {
    // Delete only the credentials file created by this invocation if no account was created.
    if (password && !await User.exists({email, role: UserRole.SUPER_ADMIN})) await unlink(credentialsFile);
    throw error;
  }
}

bootstrap().catch(error => {console.error(error.message); process.exitCode = 1;}).finally(()=>mongoose.disconnect());
