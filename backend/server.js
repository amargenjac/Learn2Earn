import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { gradeSubmissionOnChain } from './contractService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// open sqlite database
const db = new sqlite3.Database(join(__dirname, 'submissions.db'), (err) => {
  if (err) {
    console.error('Failed to open database', err);
    process.exit(1);
  }
});

function dbRun (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function dbGet (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll (sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function columnExists (tableName, columnName) {
  const rows = await dbAll(`PRAGMA table_info(${tableName})`);
  return rows.some(r => r.name === columnName);
}

async function initDb () {
  // create table if not exists
  await dbRun(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      proof_link TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved INTEGER DEFAULT 0,
      approved_at DATETIME,
      moderator_notes TEXT
    )
  `);

  if (!await columnExists('submissions', 'claimed')) {
    await dbRun(`ALTER TABLE submissions ADD COLUMN claimed INTEGER DEFAULT 0`);
  }

  if (!await columnExists('submissions', 'claimed_at')) {
    await dbRun(`ALTER TABLE submissions ADD COLUMN claimed_at DATETIME`);
  }

  if (!await columnExists('submissions', 'transaction_hash')) {
    await dbRun(`ALTER TABLE submissions ADD COLUMN transaction_hash TEXT`);
  }
}

initDb().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

function normalizeWalletAddress (addr) {
  if (!addr || typeof addr !== 'string') return null;
  return addr.trim().toLowerCase();
}

app.post('/api/submissions', async (req, res) => {
  try {
    const rawWallet = req.body.walletAddress;
    const walletAddress = normalizeWalletAddress(rawWallet);
    const name = req.body.name && String(req.body.name).trim();
    const proofLink = req.body.proofLink && String(req.body.proofLink).trim();

    if (!walletAddress || !name || !proofLink) {
      return res.status(400).json({
        message: 'Missing required fields: walletAddress, name, and proofLink are required'
      });
    }

    const existing = await dbGet('SELECT * FROM submissions WHERE wallet_address = ?', [walletAddress]);
    if (existing) {
      return res.status(400).json({ message: 'You have already submitted a proof' });
    }

    await dbRun(
      'INSERT INTO submissions (wallet_address, name, proof_link) VALUES (?, ?, ?)',
      [walletAddress, name, proofLink]
    );

    res.status(201).json({
      message: 'Submission received successfully',
      walletAddress
    });
  } catch (error) {
    console.error('Error saving submission:', error);
    res.status(500).json({
      message: 'Failed to save submission'
    });
  }
});

app.get('/api/submissions/:walletAddress', async (req, res) => {
  try {
    const rawWallet = req.params.walletAddress;
    const walletAddress = normalizeWalletAddress(rawWallet);

    if (!walletAddress) {
      return res.status(400).json({ message: 'Invalid wallet address' });
    }

    const submission = await dbGet('SELECT * FROM submissions WHERE wallet_address = ?', [walletAddress]);
    if (!submission) {
      return res.status(404).json({ message: 'No submission found' });
    }

    res.json({
      submitted: true,
      approved: Number(submission.approved) === 1,
      claimed: Number(submission.claimed || 0) === 1,
      submittedAt: submission.submitted_at,
      approvedAt: submission.approved_at,
      claimedAt: submission.claimed_at,
      transactionHash: submission.transaction_hash,
      name: submission.name,
      proofLink: submission.proof_link,
      moderatorNotes: submission.moderator_notes || null
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      message: 'Failed to fetch submission'
    });
  }
});

app.get('/api/submissions', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM submissions ORDER BY submitted_at DESC');
    const mapped = rows.map(sub => ({
      id: sub.id,
      walletAddress: sub.wallet_address,
      name: sub.name,
      proofLink: sub.proof_link,
      submitted: true,
      approved: Number(sub.approved) === 1,
      submittedAt: sub.submitted_at,
      approvedAt: sub.approved_at,
      moderatorNotes: sub.moderator_notes || null,
      claimed: Number(sub.claimed || 0) === 1,
      claimedAt: sub.claimed_at,
      transactionHash: sub.transaction_hash
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      message: 'Failed to fetch submissions'
    });
  }
});

app.put('/api/submissions/:walletAddress/approve', async (req, res) => {
  try {
    const moderatorKey = req.headers['x-moderator-key'];
    if (!process.env.MODERATOR_KEY) {
      console.warn('MODERATOR_KEY not set in environment; endpoint disabled');
      return res.status(500).json({ message: 'Server not configured for moderation' });
    }
    if (moderatorKey !== process.env.MODERATOR_KEY) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawWallet = req.params.walletAddress;
    const walletAddress = normalizeWalletAddress(rawWallet);
    const approved = !!req.body.approved;
    const moderatorNotes = req.body.moderatorNotes || null;

    if (!walletAddress) {
      return res.status(400).json({ message: 'Invalid wallet address' });
    }

    const now = new Date().toISOString();
    const result = await dbRun(
      `UPDATE submissions 
       SET approved = ?, approved_at = ?, moderator_notes = ?
       WHERE wallet_address = ?`,
      [approved ? 1 : 0, approved ? now : null, moderatorNotes, walletAddress]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json({ message: 'Submission updated successfully', approved });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ message: 'Failed to update submission' });
  }
});

app.get('/api/submissions/approved', async (req, res) => {
  try {
    const rows = await dbAll('SELECT wallet_address, name FROM submissions WHERE approved = 1');
    res.json(rows.map(r => ({ walletAddress: r.wallet_address, name: r.name })));
  } catch (error) {
    console.error('Error fetching approved submissions:', error);
    res.status(500).json({ message: 'Failed to fetch approved submissions' });
  }
});

app.post('/api/submissions/:walletAddress/claim', async (req, res) => {
  try {
    const rawWallet = req.params.walletAddress;
    const walletAddress = normalizeWalletAddress(rawWallet);

    if (!walletAddress) {
      return res.status(400).json({ message: 'Invalid wallet address' });
    }

    const submission = await dbGet(
      'SELECT * FROM submissions WHERE wallet_address = ? AND approved = 1',
      [walletAddress]
    );

    if (!submission) {
      return res.status(404).json({ message: 'No approved submission found for this wallet address' });
    }

    if (Number(submission.claimed || 0) === 1) {
      return res.status(400).json({ message: 'Reward has already been claimed' });
    }

    console.log(`Processing reward claim for ${walletAddress}`);

    // call smart contract to grade/distribute reward on-chain
    const contractResult = await gradeSubmissionOnChain(walletAddress, true);

    if (!contractResult) {
      console.error('gradeSubmissionOnChain returned falsy result');
      return res.status(500).json({ message: 'Smart contract call returned an unexpected result' });
    }

    if (contractResult.success) {
      // update DB with claimed info and transaction hash
      const now = new Date().toISOString();
      await dbRun(
        'UPDATE submissions SET claimed = 1, claimed_at = ?, transaction_hash = ? WHERE wallet_address = ?',
        [now, contractResult.txId || null, walletAddress]
      );

      return res.json({
        message: 'Reward successfully claimed! B3TR tokens have been distributed.',
        txId: contractResult.txId,
        success: true
      });
    } else {
      console.error('Smart contract transaction failed:', contractResult.error);
      return res.status(500).json({
        message: `Smart contract transaction failed: ${contractResult.error}`,
        error: contractResult.error
      });
    }
  } catch (error) {
    console.error('Error processing reward claim:', error);
    res.status(500).json({ message: 'Failed to process reward claim' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
