const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Database
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                password VARCHAR(255) NOT NULL,
                two_fa VARCHAR(255),
                note TEXT,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verified_at TIMESTAMP,
                sold_at TIMESTAMP
            )
        `);
        console.log('Database initialized');
    } catch (err) {
        console.error('DB init error:', err);
    } finally {
        client.release();
    }
}

// GET all accounts
app.get('/api/accounts', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET accounts by status
app.get('/api/accounts/status/:status', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM accounts WHERE status = $1 ORDER BY created_at DESC',
            [req.params.status]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST new account
app.post('/api/accounts', async (req, res) => {
    const { email, password, two_fa, note, status } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO accounts (email, password, two_fa, note, status)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [email, password, two_fa || '', note || '', status || 'active']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update account status
app.put('/api/accounts/:id', async (req, res) => {
    const { status, verified_at, sold_at } = req.body;
    try {
        const updates = [];
        const values = [];
        let idx = 1;

        if (status) { updates.push(`status = $${idx++}`); values.push(status); }
        if (verified_at !== undefined) { updates.push(`verified_at = $${idx++}`); values.push(verified_at); }
        if (sold_at !== undefined) { updates.push(`sold_at = $${idx++}`); values.push(sold_at); }

        values.push(req.params.id);
        const query = `UPDATE accounts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE account
app.delete('/api/accounts/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM accounts WHERE id = $1', [req.params.id]);
        res.json({ message: 'Account deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET stats
app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'active') as active,
                COUNT(*) FILTER (WHERE status = 'verify') as verify,
                COUNT(*) FILTER (WHERE status = 'verified') as verified,
                COUNT(*) FILTER (WHERE status = 'sold') as sold
            FROM accounts
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
