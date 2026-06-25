import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { logSession } from '../middleware/logger';

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const exists = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (exists.rows.length > 0) return res.status(409).json({ error: 'Username taken' });

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password + salt, 10);
  const result = await pool.query(
    'INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3) RETURNING id',
    [username, hash, salt]
  );
  const userId = result.rows[0].id;

  await logSession(username, req);

  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({ token, userId, username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = await pool.query('SELECT id, username, password_hash, salt FROM users WHERE username = $1', [username]);
  if (user.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password + user.rows[0].salt, user.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  await logSession(username, req);

  const token = jwt.sign({ userId: user.rows[0].id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({ token, userId: user.rows[0].id, username: user.rows[0].username });
});

export default router;
