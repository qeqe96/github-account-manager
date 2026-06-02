# Supabase Kurulum Rehberi

## 1. Supabase Projesi Oluştur

1. [supabase.com](https://supabase.com) adresine git
2. **"New Project"** oluştur
3. Proje adı: `github-account-manager`
4. Region: `Frankfurt (eu-central-1)` (Türkiye'ye en yakın)
5. Free tier seç
6. **"Create New Project"** bekle (1-2 dk)

## 2. Tablo Oluştur (SQL Editor)

Sol menüden **"SQL Editor"** → **"New Query"** → Aşağıdaki SQL'i yapıştır → **"Run"**

```sql
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    two_fa TEXT,
    note TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    sold_at TIMESTAMP WITH TIME ZONE
);

-- Row Level Security aç (güvenlik)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilsin (public read)
CREATE POLICY "Allow public read" ON accounts
    FOR SELECT USING (true);

-- Herkes yazabilsin (public insert/update/delete)
CREATE POLICY "Allow public insert" ON accounts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON accounts
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON accounts
    FOR DELETE USING (true);
```

## 3. API Anahtarlarını Al

Sol menüden **"Project Settings"** → **"API"**

- `URL` kopyala (örn: `https://xxxxx.supabase.co`)
- `anon public` key kopyala (örn: `eyJhbGciOiJIUzI1NiIs...`)

## 4. public/app.js Dosyasını Güncelle

`public/app.js` dosyasının en üstüne ekle:

```javascript
const SUPABASE_URL = 'https://SENIN_URL.supabase.co';
const SUPABASE_KEY = 'SENIN_ANON_KEY';
```

## 5. Seed Script Çalıştır

`seed.js` dosyasını da Supabase'e göre güncelleyip çalıştıracağız.

## 6. Netlify'e Deploy Et

1. [netlify.com](https://netlify.com) git
2. **"Add new site"** → **"Import an existing project"**
3. GitHub repo: `qeqe96/github-account-manager`
4. Build settings:
   - Build command: (boş bırak)
   - Publish directory: `public`
5. **"Deploy site"**
