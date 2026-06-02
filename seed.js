const { Pool } = require('pg');
require('dotenv').config();

const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Read and parse github.txt
const rawData = fs.readFileSync('github.txt', 'utf8');
const lines = rawData.split('\n').map(l => l.trim()).filter(l => l.length > 0);

function is2FAKey(str) {
    return /^[A-Z0-9]{16,32}$/.test(str);
}

function isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function parseLine(line) {
    const parts = line.split(/\s+/);

    // Remove date-only lines and time-only fragments
    if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(line) || /^\d{1,2}\.\d{1,2}\s+\d{2}\.\d{2}/.test(line)) {
        return null;
    }

    let twoFA = '';
    let password = '';
    let email = '';
    let note = '';
    let status = 'active';

    // Find email position
    let emailIdx = parts.findIndex(isEmail);
    if (emailIdx === -1) return null;

    // Check if first part is 2FA key
    if (is2FAKey(parts[0])) {
        twoFA = parts[0];
        password = parts[1] || '';

        // Email is at emailIdx
        email = parts[emailIdx];

        // Everything between password and email could be nothing
        // Everything after email until status is note
        const remainingAfterEmail = parts.slice(emailIdx + 1);

        // Check for status keywords
        const statusIdx = remainingAfterEmail.findIndex(p =>
            p.toLowerCase().includes('satıldı') ||
            p.toLowerCase().includes('onaylanıyo') ||
            p.toLowerCase().includes('onaylandi')
        );

        if (statusIdx !== -1) {
            const statusWord = remainingAfterEmail[statusIdx].toLowerCase();
            if (statusWord.includes('satıldı')) status = 'sold';
            else if (statusWord.includes('onaylanıyo')) status = 'verified';
            else if (statusWord.includes('onaylandi')) status = 'verified';

            note = remainingAfterEmail.slice(0, statusIdx).join(' ');
        } else {
            note = remainingAfterEmail.join(' ');
        }
    } else {
        // No 2FA key
        password = parts[0];
        email = parts[emailIdx];

        const remainingAfterEmail = parts.slice(emailIdx + 1);
        const statusIdx = remainingAfterEmail.findIndex(p =>
            p.toLowerCase().includes('satıldı') ||
            p.toLowerCase().includes('onaylanıyo') ||
            p.toLowerCase().includes('onaylandi')
        );

        if (statusIdx !== -1) {
            const statusWord = remainingAfterEmail[statusIdx].toLowerCase();
            if (statusWord.includes('satıldı')) status = 'sold';
            else if (statusWord.includes('onaylanıyo')) status = 'verified';
            else if (statusWord.includes('onaylandi')) status = 'verified';

            note = remainingAfterEmail.slice(0, statusIdx).join(' ');
        } else {
            note = remainingAfterEmail.join(' ');
        }
    }

    return { twoFA, password, email, note, status };
}

async function seed() {
    const client = await pool.connect();
    try {
        // Ensure table exists
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

        // Clear existing data
        await client.query('DELETE FROM accounts');

        let inserted = 0;
        let skipped = 0;

        for (const line of lines) {
            const parsed = parseLine(line);
            if (!parsed) {
                skipped++;
                continue;
            }

            const { twoFA, password, email, note, status } = parsed;

            if (!email || !password) {
                skipped++;
                continue;
            }

            let verifiedAt = null;
            let soldAt = null;

            if (status === 'verified') {
                verifiedAt = new Date().toISOString();
            } else if (status === 'sold') {
                soldAt = new Date().toISOString();
            }

            await client.query(
                `INSERT INTO accounts (email, password, two_fa, note, status, verified_at, sold_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [email, password, twoFA, note, status, verifiedAt, soldAt]
            );
            inserted++;
        }

        console.log(`Seeding complete: ${inserted} accounts inserted, ${skipped} lines skipped`);
    } catch (err) {
        console.error('Seed error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
