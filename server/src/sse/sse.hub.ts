import { Response } from 'express';
import { User } from '../models/User.js';

interface SSEClient {
  userId: string;
  res: Response;
  expiresAt: number;
  authVersion: number;
}

class SSEHub {
  private clients: SSEClient[] = [];

  constructor() {
    // إرسال نبضات دورية (Heartbeat) كل 25 ثانية لمنع انقطاع الاتصال
    const timer = setInterval(() => {
      void this.broadcastHeartbeat();
    }, 25000);
    timer.unref();
  }

  public addClient(userId: string, res: Response, expiresAt: number, authVersion = 0): void {
    this.clients.push({ userId, res, expiresAt, authVersion });
    // console.log(`📡 SSE Client connected: User ${userId} (Total clients: ${this.clients.length})`);

    // إرسال رسالة ترحيبية فورية لتأكيد الاتصال
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Connection Established' })}\n\n`);
  }

  public removeClient(res: Response): void {
    this.clients = this.clients.filter(client => client.res !== res);
    // console.log(`🔌 SSE Client disconnected (Remaining: ${this.clients.length})`);
  }

  public disconnectUser(userId: string): void {
    for (const client of [...this.clients]) {
      if (client.userId === userId) { client.res.end(); this.removeClient(client.res); }
    }
  }

  public sendToUser(userId: string, payload: any): void {
    const targetClients = this.clients.filter(c => c.userId === userId.toString());
    const dataString = `data: ${JSON.stringify(payload)}\n\n`;

    targetClients.forEach(client => {
      try {
        client.res.write(dataString);
      } catch (err) {
        console.error('Error sending SSE to user:', err);
      }
    });
  }

  public broadcast(payload: any): void {
    const dataString = `data: ${JSON.stringify(payload)}\n\n`;
    this.clients.forEach(client => {
      try {
        client.res.write(dataString);
      } catch (err) {
        // خطأ اتصال
      }
    });
  }

  private async broadcastHeartbeat(): Promise<void> {
    if (!this.clients.length) return;
    try {
      const active = await User.find({_id: {$in: this.clients.map(c => c.userId)}, isActive: true, isDeleted: false}).select('_id authVersion').lean();
      const versions = new Map(active.map(u => [String(u._id), u.authVersion || 0]));
      for (const client of [...this.clients]) {
        if (versions.get(client.userId) !== client.authVersion || client.expiresAt <= Date.now() || client.res.destroyed) {
          client.res.end(); this.removeClient(client.res);
        }
      }
    } catch { for (const client of [...this.clients]) { client.res.end(); this.removeClient(client.res); } }
    this.clients.forEach(client => {
      try {
        client.res.write(': keepalive\n\n');
      } catch {
        // تجاهل
      }
    });
  }
}

export const sseHub = new SSEHub();

