// Github Account Manager Application
// ===================================

const HOURS_72 = 72 * 60 * 60 * 1000;
const FIXED_PASSWORD = '0123456Asd%';
const API_URL = '';

let accounts = [];

const modalOverlay = document.getElementById('modal-overlay');
const toastContainer = document.getElementById('toast-container');
const searchInput = document.getElementById('search-input');

async function api(method, endpoint, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_URL + endpoint, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function init() {
    await loadAccounts();
    renderAll();
    startTimer();
    setupEventListeners();
    checkExpiredAccounts();
}

async function loadAccounts() {
    try {
        accounts = await api('GET', '/api/accounts');
    } catch (e) {
        showToast('Veriler yüklenemedi', 'error');
        accounts = [];
    }
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const panel = item.dataset.panel;
            showPanel(panel);
            setActiveNav(item);
        });
    });

    document.getElementById('add-account-form').addEventListener('submit', handleAddAccount);
    searchInput.addEventListener('input', handleSearch);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

function showPanel(panelName) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active-panel'));
    document.getElementById(`panel-${panelName}`).classList.add('active-panel');

    const titles = {
        dashboard: 'Dashboard',
        active: 'Aktif Hesaplar',
        verify: 'Doğrulanacak Hesaplar',
        verified: 'Onaylanan Hesaplar',
        sold: 'Satılan Hesaplar'
    };
    document.getElementById('page-title').textContent = titles[panelName] || 'Dashboard';
}

function setActiveNav(item) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    item.classList.add('active');
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

    try {
        await api('POST', '/api/accounts', { email, password, two_fa, note, status: 'active' });
        await loadAccounts();
        renderAll();
        closeModal();
        showToast('Hesap başarıyla eklendi', 'success');
    } catch (err) {
        showToast('Hata: ' + err.message, 'error');
    }
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

    try {
        await api('PUT', `/api/accounts/${id}`, { status: newStatus, verified_at: verifiedAt, sold_at: soldAt });
        await loadAccounts();
        renderAll();
    } catch (err) {
        showToast('Hata: ' + err.message, 'error');
    }
}

async function sellAccount(id) {
    try {
        await api('PUT', `/api/accounts/${id}`, { status: 'sold', sold_at: new Date().toISOString() });
        await loadAccounts();
        renderAll();
        showToast('Hesap satıldı olarak işaretlendi', 'success');
    } catch (err) {
        showToast('Hata: ' + err.message, 'error');
    }
}

async function deleteAccount(id) {
    if (!confirm('Bu hesabı silmek istediğinize emin misiniz?')) return;

    try {
        await api('DELETE', `/api/accounts/${id}`);
        await loadAccounts();
        renderAll();
        showToast('Hesap silindi', 'info');
    } catch (err) {
        showToast('Hata: ' + err.message, 'error');
    }
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

function renderAll() {
    updateStats();
    updateNavStats();
    renderActiveTable();
    renderVerifyTable();
    renderVerifiedTable();
    renderSoldTable();
    renderDashboardLists();
}

function updateStats() {
    document.getElementById('stat-active').textContent = accounts.filter(a => a.status === 'active').length;
    document.getElementById('stat-verify').textContent = accounts.filter(a => a.status === 'verify').length;
    document.getElementById('stat-verified').textContent = accounts.filter(a => a.status === 'verified').length;
    document.getElementById('stat-sold').textContent = accounts.filter(a => a.status === 'sold').length;
}

function updateNavStats() {
    document.getElementById('nav-total').textContent = accounts.length;
    document.getElementById('nav-active').textContent = accounts.filter(a => a.status === 'active').length;
    document.getElementById('nav-verify').textContent = accounts.filter(a => a.status === 'verify').length;
    document.getElementById('nav-verified').textContent = accounts.filter(a => a.status === 'verified').length;
    document.getElementById('nav-sold').textContent = accounts.filter(a => a.status === 'sold').length;
}

function renderActiveTable() {
    const tbody = document.getElementById('table-active');
    const activeAccounts = getFilteredAccounts('active');
    document.getElementById('count-active').textContent = activeAccounts.length;

    if (activeAccounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>Aktif hesap yok</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = activeAccounts.map(acc => {
        const timer = formatTimeRemaining(acc.created_at, acc.status);
        return `
            <tr>
                <td>
                    <div class="account-cell">
                        <div class="account-avatar">${getInitials(acc.email)}</div>
                        <div class="account-details">
                            <span class="account-email">${escapeHtml(acc.email)}</span>
                            ${acc.note ? `<span class="account-note">${escapeHtml(acc.note)}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="copy-field" onclick="copyToClipboard('${escapeHtml(acc.password)}', 'Şifre')">
                        <i class="fas fa-key"></i>
                        <span>${maskText(acc.password)}</span>
                    </div>
                </td>
                <td>
                    ${acc.two_fa ? `
                    <div class="copy-field" onclick="copyToClipboard('${escapeHtml(acc.two_fa)}', '2FA Key')">
                        <i class="fas fa-shield-alt"></i>
                        <span>${maskText(acc.two_fa)}</span>
                    </div>` : '-'}
                </td>
                <td>${formatDate(acc.created_at)}</td>
                <td>
                    <span class="timer ${timer.className}" data-timer="${acc.id}">
                        <i class="fas fa-hourglass-half"></i>
                        ${timer.text}
                    </span>
                </td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-action copy" onclick="copyAccountInfo('${acc.id}')" title="Tümünü Kopyala">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-action verify" onclick="verifyAccount('${acc.id}')" title="Doğrulanacaklara Taşı">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                        <button class="btn-action delete" onclick="deleteAccount('${acc.id}')" title="Sil">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderVerifyTable() {
    const tbody = document.getElementById('table-verify');
    const verifyAccounts = getFilteredAccounts('verify');
    document.getElementById('count-verify').textContent = verifyAccounts.length;

    if (verifyAccounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>Doğrulanacak hesap yok</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = verifyAccounts.map(acc => `
        <tr>
            <td>
                <div class="account-cell">
                    <div class="account-avatar">${getInitials(acc.email)}</div>
                    <div class="account-details">
                        <span class="account-email">${escapeHtml(acc.email)}</span>
                        ${acc.note ? `<span class="account-note">${escapeHtml(acc.note)}</span>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="copy-field" onclick="copyToClipboard('${escapeHtml(acc.password)}', 'Şifre')">
                    <i class="fas fa-key"></i>
                    <span>${maskText(acc.password)}</span>
                </div>
            </td>
            <td>
                ${acc.two_fa ? `
                <div class="copy-field" onclick="copyToClipboard('${escapeHtml(acc.two_fa)}', '2FA Key')">
                    <i class="fas fa-shield-alt"></i>
                    <span>${maskText(acc.two_fa)}</span>
                </div>` : '-'}
            </td>
            <td>${formatDate(acc.created_at)}</td>
            <td>
                <span class="status-badge verify">
                    <i class="fas fa-clock"></i>
                    Bekliyor
                </span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn-action copy" onclick="copyAccountInfo('${acc.id}')" title="Tümünü Kopyala">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn-action verify" onclick="verifyAccount('${acc.id}')" title="Onayla">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteAccount('${acc.id}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderVerifiedTable() {
    const tbody = document.getElementById('table-verified');
    const verifiedAccounts = getFilteredAccounts('verified');
    document.getElementById('count-verified').textContent = verifiedAccounts.length;

    if (verifiedAccounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>Onaylanan hesap yok</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = verifiedAccounts.map(acc => `
        <tr>
            <td>
                <div class="account-cell">
                    <div class="account-avatar">${getInitials(acc.email)}</div>
                    <div class="account-details">
                        <span class="account-email">${escapeHtml(acc.email)}</span>
                        ${acc.note ? `<span class="account-note">${escapeHtml(acc.note)}</span>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="copy-field" onclick="copyToClipboard('${escapeHtml(acc.password)}', 'Şifre')">
                    <i class="fas fa-key"></i>
                    <span>${maskText(acc.password)}</span>
                </div>
            </td>
            <td>
                ${acc.two_fa ? `
                <div class="copy-field" onclick="copyToClipboard('${escapeHtml(acc.two_fa)}', '2FA Key')">
                    <i class="fas fa-shield-alt"></i>
                    <span>${maskText(acc.two_fa)}</span>
                </div>` : '-'}
            </td>
            <td>${formatDate(acc.verified_at)}</td>
            <td>
                <span class="status-badge verified">
                    <i class="fas fa-check-circle"></i>
                    Onaylandı
                </span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn-action copy" onclick="copyAccountInfo('${acc.id}')" title="Tümünü Kopyala">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn-action sell" onclick="sellAccount('${acc.id}')" title="Satıldı Olarak İşaretle">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteAccount('${acc.id}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderSoldTable() {
    const tbody = document.getElementById('table-sold');
    const soldAccounts = getFilteredAccounts('sold');
    document.getElementById('count-sold').textContent = soldAccounts.length;

    if (soldAccounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-inbox"></i><p>Satılan hesap yok</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = soldAccounts.map(acc => `
        <tr>
            <td>
                <div class="account-cell">
                    <div class="account-avatar">${getInitials(acc.email)}</div>
                    <div class="account-details">
                        <span class="account-email">${escapeHtml(acc.email)}</span>
                        ${acc.note ? `<span class="account-note">${escapeHtml(acc.note)}</span>` : ''}
                    </div>
                </div>
            </td>
            <td>
                <div class="copy-field" onclick="copyToClipboard('${escapeHtml(acc.password)}', 'Şifre')">
                    <i class="fas fa-key"></i>
                    <span>${maskText(acc.password)}</span>
                </div>
            </td>
            <td>
                ${acc.two_fa ? `
                <div class="copy-field" onclick="copyToClipboard('${escapeHtml(acc.two_fa)}', '2FA Key')">
                    <i class="fas fa-shield-alt"></i>
                    <span>${maskText(acc.two_fa)}</span>
                </div>` : '-'}
            </td>
            <td>${formatDate(acc.sold_at)}</td>
            <td>
                <span class="status-badge sold">
                    <i class="fas fa-shopping-cart"></i>
                    Satıldı
                </span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn-action copy" onclick="copyAccountInfo('${acc.id}')" title="Tümünü Kopyala">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteAccount('${acc.id}')" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderDashboardLists() {
    const activeList = document.getElementById('dashboard-active-list');
    const activeAccounts = accounts.filter(a => a.status === 'active').slice(0, 5);

    if (activeAccounts.length === 0) {
        activeList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Henüz hesap eklenmemiş</p>
            </div>`;
    } else {
        activeList.innerHTML = activeAccounts.map(acc => {
            const timer = formatTimeRemaining(acc.created_at, acc.status);
            return `
            <div class="list-item" onclick="showPanel('active'); setActiveNav(document.querySelector('[data-panel=\"active\"]'))">
                <div class="list-item-info">
                    <div class="account-avatar">${getInitials(acc.email)}</div>
                    <div class="list-item-meta">
                        <span class="list-item-title">${escapeHtml(acc.email)}</span>
                        <span class="list-item-subtitle">${formatDate(acc.created_at)}</span>
                    </div>
                </div>
                <span class="list-item-timer ${timer.className}">${timer.text}</span>
            </div>`;
        }).join('');
    }

    const verifyList = document.getElementById('dashboard-verify-list');
    const verifyAccounts = accounts.filter(a => a.status === 'verify').slice(0, 5);

    if (verifyAccounts.length === 0) {
        verifyList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Doğrulanacak hesap yok</p>
            </div>`;
    } else {
        verifyList.innerHTML = verifyAccounts.map(acc => `
            <div class="list-item" onclick="showPanel('verify'); setActiveNav(document.querySelector('[data-panel=\"verify\"]'))">
                <div class="list-item-info">
                    <div class="account-avatar">${getInitials(acc.email)}</div>
                    <div class="list-item-meta">
                        <span class="list-item-title">${escapeHtml(acc.email)}</span>
                        <span class="list-item-subtitle">Bekliyor</span>
                    </div>
                </div>
                <span class="status-badge verify">
                    <i class="fas fa-clock"></i>
                </span>
            </div>
        `).join('');
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    renderAll();

    if (!query) return;

    document.querySelectorAll('.accounts-table tbody tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        if (!text.includes(query)) {
            row.style.display = 'none';
        }
    });
}

function getFilteredAccounts(status) {
    const query = searchInput.value.toLowerCase();
    let filtered = accounts.filter(a => a.status === status);

    if (query) {
        filtered = filtered.filter(a =>
            a.email.toLowerCase().includes(query) ||
            (a.note && a.note.toLowerCase().includes(query))
        );
    }

    return filtered;
}

function startTimer() {
    setInterval(() => {
        checkExpiredAccounts();

        document.querySelectorAll('[data-timer]').forEach(el => {
            const id = el.dataset.timer;
            const acc = accounts.find(a => a.id === id);
            if (acc && acc.status === 'active') {
                const timer = formatTimeRemaining(acc.created_at, acc.status);
                el.innerHTML = `<i class="fas fa-hourglass-half"></i> ${timer.text}`;
                el.className = `timer ${timer.className}`;
            }
        });
    }, 1000);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span class="toast-message">${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function maskText(text) {
    if (!text) return '';
    if (text.length <= 8) return '•'.repeat(text.length);
    return text.substring(0, 3) + '•'.repeat(text.length - 6) + text.substring(text.length - 3);
}

init();
