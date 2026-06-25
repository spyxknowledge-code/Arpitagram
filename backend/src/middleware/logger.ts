import { Request } from 'express';
import { pool } from '../db/pool';

export const logSession = async (username: string, req: Request) => {
  const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || '0.0.0.0';
  const deviceInfo = req.headers['user-agent'] || 'unknown';
  await pool.query(
    'INSERT INTO user_sessions (username, ip_address, device_info, login_time) VALUES ($1, $2, $3, NOW())',
    [username, ip, deviceInfo]
  );
};
