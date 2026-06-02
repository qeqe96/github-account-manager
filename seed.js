// Supabase Seed Script - github.txt verilerini Supabase'e yükler
// ================================================================

const fs = require('fs');

// Supabase config - KULLANICI BUNLARI DOLDURACAK
const SUPABASE_URL = 'https://kzxidldbmjuhywoguoti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eGlkbGRibWp1aHl3b2d1b3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Mjc5OTUsImV4cCI6MjA5NjAwMzk5NX0.NwflyEPFj5oVwQBjIAwP2EXvLJBVUSh4Jmeitfz2cag';

function is2FAKey(str) {
    return /^[A-Z0-9]{16,32}$/.test(str);
}

function isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function parseLine(line) {
    const parts = line.split(/\s+/);

    if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(line) || /^\d{1,2}\.\d{1,2}\s+\d{2}\.\d{2}/.test(line)) {
        return null;
    }

    let twoFA = '';
    let password = '';
    let email = '';
    let note = '';
    let status = 'active';

    let emailIdx = parts.findIndex(isEmail);
    if (emailIdx === -1) return null;

    if (is2FAKey(parts[0])) {
        twoFA = parts[0];
        password = parts[1] || '';
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
    } else {
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

    return { two_fa: twoFA, password, email, note, status };
}

async function seed() {
    if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
        console.error('HATA: SUPABASE_URL ve SUPABASE_KEY değerlerini seed.js dosyasında doldurun!');
        process.exit(1);
    }

    const rawData = fs.readFileSync('github.txt', 'utf8');
    const lines = rawData.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let inserted = 0;
    let skipped = 0;

    for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) { skipped++; continue; }

        const { two_fa, password, email, note, status } = parsed;
        if (!email || !password) { skipped++; continue; }

        let verifiedAt = null;
        let soldAt = null;

        if (status === 'verified') verifiedAt = new Date().toISOString();
        else if (status === 'sold') soldAt = new Date().toISOString();

        const obj = {
            email,
            password,
            two_fa,
            note,
            status,
            created_at: new Date().toISOString(),
            verified_at: verifiedAt,
            sold_at: soldAt
        };

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/accounts`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(obj)
            });

            if (res.ok) {
                inserted++;
                console.log(`✓ ${email} eklendi (${status})`);
            } else {
                const err = await res.text();
                console.error(`✗ ${email} hata: ${err}`);
                skipped++;
            }
        } catch (err) {
            console.error(`✗ ${email} hata: ${err.message}`);
            skipped++;
        }
    }

    console.log(`\nSeed tamamlandı: ${inserted} hesap eklendi, ${skipped} satır atlandı`);
}

seed();
