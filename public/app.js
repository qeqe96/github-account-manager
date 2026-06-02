// Github Account Manager - Supabase Edition
// ==========================================

const HOURS_72 = 72 * 60 * 60 * 1000;
const FIXED_PASSWORD = '0123456Asd%';
const ITEMS_PER_PAGE = 20;

const SUPABASE_URL = 'https://kzxidldbmjuhywoguoti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eGlkbGRibWp1aHl3b2d1b3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0Mjc5OTUsImV4cCI6MjA5NjAwMzk5NX0.NwflyEPFj5oVwQBjIAwP2EXvLJBVUSh4Jmeitfz2cag';

let supabase = null;
let accounts = [];
let currentTab = 'all';
let currentPage = 1;

const modalOverlay = document.getElementById('modal-overlay');
const toastContainer = document.getElementById('toast-container');
const searchInput = document.getElementById('search-input');

function initSupabase() {
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        showToast('Supabase yüklenemedi, localStorage moduna geçiliyor', 'info');
        supabase = null;
    }
}

async function dbSelect(table, filters) {
    if (!supabase) {
        const data = JSON.parse(localStorage.getItem(table) || '[]');
        if (filters) {
            return { data: data.filter(filters), error: null };
        }
        return { data, error: null };
    }
    let query = supabase.from(table).select('*');
    if (filters && filters.eq) {
        Object.entries(filters.eq).forEach(([k, v]) => { query = query.eq(k, v); });
    }
    if (filters && filters.order) {
        query = query.order(filters.order.column, { ascending: filters.order.ascending });
    }
    return query;
}

async function dbInsert(table, obj) {
    if (!supabase) {
        const data = JSON.parse(localStorage.getItem(table) || '[]');
        obj.id = Date.now();
        data.push(obj);
        localStorage.setItem(table, JSON.stringify(data));
        return { data: [obj], error: null };
    }
    return supabase.from(table).insert(obj).select();
}

async function dbUpdate(table, id, obj) {
    if (!supabase) {
        const data = JSON.parse(localStorage.getItem(table) || '[]');
        const idx = data.findIndex(x => x.id == id);
        if (idx >= 0) { data[idx] = { ...data[idx], ...obj }; localStorage.setItem(table, JSON.stringify(data)); }
        return { data: [data[idx]], error: null };
    }
    return supabase.from(table).update(obj).eq('id', id).select();
}

async function dbDelete(table, id) {
    if (!supabase) {
        let data = JSON.parse(localStorage.getItem(table) || '[]');
        data = data.filter(x => x.id != id);
        localStorage.setItem(table, JSON.stringify(data));
        return { error: null };
    }
    return supabase.from(table).delete().eq('id', id);
}

async function init() {
    initSupabase();
    await loadAccounts();
    renderAll();
    startTimer();
    setupEventListeners();
    checkExpiredAccounts();
}

async function loadAccounts() {
    const { data, error } = await dbSelect('accounts', { order: { column: 'created_at', ascending: false } });
    if (error) {
        showToast('Veriler yüklenemedi', 'error');
        accounts = [];
    } else {
        accounts = data || [];
    }
}

function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab;
            currentPage = 1;
            setActiveTab(btn);
            renderTable();
        });
    });

    document.getElementById('add-account-form').addEventListener('submit', handleAddAccount);
    searchInput.addEventListener('input', () => { currentPage = 1; renderTable(); });

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function setActiveTab(btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function openModal() {
    modalOverlay.classList.add('open');
    document.getElementById('acc-email').focus();
}

function closeModal() {
    modalOverlay.classList.remove('open');
    document.getElementById('add-account-form').reset();
}

function setFixedPassword() {
    document.getElementById('acc-password').value = FIXED_PASSWORD;
    showToast('Sabit şifre uygulandı: ' + FIXED_PASSWORD, 'info');
}

async function handleAddAccount(e) {
    e.preventDefault();

    const email = document.getElementById('acc-email').value.trim();
    const password = document.getElementById('acc-password').value.trim();
    const two_fa = document.getElementById('acc-2fa').value.trim();
    const note = document.getElementById('acc-note').value.trim();

    if (!email || !password) {
        showToast('E-posta ve şifre zorunludur', 'error');
        return;
    }

    const obj = {
        email,
        password,
        two_fa,
        note,
        status: 'active',
        created_at: new Date().toISOString(),
        verified_at: null,
        sold_at: null
    };

    const { data, error } = await dbInsert('accounts', obj);
    if (error) {
        showToast('Hata: ' + error.message, 'error');
        return;
    }

    await loadAccounts();
    renderAll();
    closeModal();
    showToast('Hesap başarıyla eklendi', 'success');
}

function checkExpiredAccounts() {
    const now = Date.now();
    let changed = false;

    accounts.forEach(acc => {
        if (acc.status === 'active') {
            const elapsed = now - new Date(acc.created_at).getTime();
            if (elapsed >= HOURS_72) {
                acc.status = 'verify';
                changed = true;
            }
        }
    });

    if (changed) renderAll();
}

async function verifyAccount(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;

    let newStatus, verifiedAt, soldAt;
    if (acc.status === 'active') {
        newStatus = 'verify';
        showToast('Hesap doğrulanacaklara taşındı', 'info');
    } else if (acc.status === 'verify') {
        newStatus = 'verified';
        verifiedAt = new Date().toISOString();
        showToast('Hesap onaylandı', 'success');
    } else {
        return;
    }

    const { error } = await dbUpdate('accounts', id, { status: newStatus, verified_at: verifiedAt, sold_at: soldAt });
    if (error) {
        showToast('Hata: ' + error.message, 'error');
        return;
    }

    await loadAccounts();
    renderAll();
}

async function sellAccount(id) {
    const { error } = await dbUpdate('accounts', id, { status: 'sold', sold_at: new Date().toISOString() });
    if (error) {
        showToast('Hata: ' + error.message, 'error');
        return;
    }

    await loadAccounts();
    renderAll();
    showToast('Hesap satıldı olarak işaretlendi', 'success');
}

async function deleteAccount(id) {
    if (!confirm('Bu hesabı silmek istediğinize emin misiniz?')) return;

    const { error } = await dbDelete('accounts', id);
    if (error) {
        showToast('Hata: ' + error.message, 'error');
        return;
    }

    await loadAccounts();
    renderAll();
    showToast('Hesap silindi', 'info');
}

async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`${label} kopyalandı`, 'success');
    } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(`${label} kopyalandı`, 'success');
    }
}

function copyAccountInfo(id) {
    const acc = accounts.find(a => a.id === id);
    if (!acc) return;

    const info = `E-posta: ${acc.email}\nŞifre: ${acc.password}${acc.two_fa ? '\n2FA Key: ' + acc.two_fa : ''}`;
    copyToClipboard(info, 'Hesap bilgileri');
}

function formatTimeRemaining(createdAt, status, verifiedAt) {
    const now = Date.now();
    let targetTime;

    if (status === 'active') {
        targetTime = new Date(createdAt).getTime() + HOURS_72;
    } else if (status === 'verified' && verifiedAt) {
        targetTime = new Date(verifiedAt).getTime() + HOURS_72;
    } else {
        return { text: '-', className: '' };
    }

    const remaining = targetTime - now;

    if (remaining <= 0) {
        return { text: 'Süre doldu', className: 'danger' };
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    let className = '';
    if (hours < 6) className = 'danger';
    else if (hours < 24) className = 'warning';

    return {
        text: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        className
    };
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getInitials(email) {
    return email.substring(0, 2).toUpperCase();
}

function getFilteredAccounts() {
    const query = searchInput.value.toLowerCase();
    let filtered = accounts;

    if (currentTab !== 'all') {
        filtered = filtered.filter(a => a.status === currentTab);
    }

    if (query) {
        filtered = filtered.filter(a =>
            a.email.toLowerCase().includes(query) ||
            (a.note && a.note.toLowerCase().includes(query)) ||
            (a.two_fa && a.two_fa.toLowerCase().includes(query))
        );
    }

    return filtered;
}

function renderAll() {
    updateStats();
    renderTable();
}

function updateStats() {
    document.getElementById('stat-total').textContent = accounts.length;
    document.getElementById('stat-active').textContent = accounts.filter(a => a.status === 'active').length;
    document.getElementById('stat-verify').textContent = accounts.filter(a => a.status === 'verify').length;
    document.getElementById('stat-verified').textContent = accounts.filter(a => a.status === 'verified').length;
    document.getElementById('stat-sold').textContent = accounts.filter(a => a.status === 'sold').length;
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    const filtered = getFilteredAccounts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

    document.getElementById('showing-count').textContent = filtered.length;
    document.getElementById('page-info').textContent = `Sayfa ${currentPage} / ${totalPages}`;

    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-cell"><div class="empty-state"><i class="fas fa-inbox"></i><p>Hesap bulunamadı</p></div></td></tr>`;
        renderPagination(totalPages);
        return;
    }

    tbody.innerHTML = pageItems.map(acc => {
        const timer = acc.status === 'active' ? formatTimeRemaining(acc.created_at, acc.status) : null;
        const statusLabels = {
            active: '<span class="tag tag-blue"><i class="fas fa-clock"></i> Aktif</span>',
            verify: '<span class="tag tag-orange"><i class="fas fa-check-circle"></i> Doğrulanacak</span>',
            verified: '<span class="tag tag-green"><i class="fas fa-shield-check"></i> Onaylandı</span>',
            sold: '<span class="tag tag-purple"><i class="fas fa-shopping-cart"></i> Satıldı</span>'
        };

        let actionButtons = '';
        if (acc.status === 'active') {
            actionButtons = `
                <button class="btn-row" onclick="verifyAccount('${acc.id}')" title="Doğrulanacak"><i class="fas fa-arrow-right"></i></button>
                <button class="btn-row" onclick="deleteAccount('${acc.id}')" title="Sil"><i class="fas fa-trash"></i></button>`;
        } else if (acc.status === 'verify') {
            actionButtons = `
                <button class="btn-row" onclick="verifyAccount('${acc.id}')" title="Onayla"><i class="fas fa-check"></i></button>
                <button class="btn-row" onclick="deleteAccount('${acc.id}')" title="Sil"><i class="fas fa-trash"></i></button>`;
        } else if (acc.status === 'verified') {
            actionButtons = `
                <button class="btn-row" onclick="sellAccount('${acc.id}')" title="Sat"><i class="fas fa-shopping-cart"></i></button>
                <button class="btn-row" onclick="deleteAccount('${acc.id}')" title="Sil"><i class="fas fa-trash"></i></button>`;
        } else {
            actionButtons = `<button class="btn-row" onclick="deleteAccount('${acc.id}')" title="Sil"><i class="fas fa-trash"></i></button>`;
        }

        return `
            <tr>
                <td><div class="account-cell"><div class="account-avatar">${getInitials(acc.email)}</div><span class="account-email">${escapeHtml(acc.email)}</span></div></td>
                <td><span class="mono" onclick="copyToClipboard('${escapeHtml(acc.password)}', 'Şifre')" title="Kopyala">${escapeHtml(acc.password)}</span></td>
                <td><span class="mono" onclick="copyToClipboard('${escapeHtml(acc.two_fa || '-')}', '2FA')" title="Kopyala">${escapeHtml(acc.two_fa || '-')}</span></td>
                <td>${formatDate(acc.created_at)}</td>
                <td>${timer ? `<span class="timer ${timer.className}">${timer.text}</span>` : '-'}</td>
                <td>${statusLabels[acc.status] || acc.status}</td>
                <td>${acc.note ? escapeHtml(acc.note) : '-'}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-row" onclick="copyAccountInfo('${acc.id}')" title="Tümünü Kopyala"><i class="fas fa-copy"></i></button>
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `<button class="btn-page" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="btn-page ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="page-dots">...</span>`;
        }
    }

    html += `<button class="btn-page" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

function changePage(page) {
    const filtered = getFilteredAccounts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
}

function startTimer() {
    setInterval(() => {
        checkExpiredAccounts();
        document.querySelectorAll('.timer').forEach(el => {
            const id = el.closest('tr')?.dataset?.id;
            if (!id) return;
            const acc = accounts.find(a => a.id === id);
            if (acc && acc.status === 'active') {
                const timer = formatTimeRemaining(acc.created_at, acc.status);
                el.textContent = timer.text;
                el.className = `timer ${timer.className}`;
            }
        });
    }, 1000);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span class="toast-message">${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

init();
