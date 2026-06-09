// Імпортуємо потрібні функції з Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

// Конфігурація Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB5xv6cpjH_Nbrz_BNfGdNSd5CFquBBnus",
    authDomain: "ogooo-a9ba3.firebaseapp.com",
    projectId: "ogooo-a9ba3",
    storageBucket: "ogooo-a9ba3.firebasestorage.app",
    messagingSenderId: "602230576066",
    appId: "1:602230576066:web:1d095a5d535dda5c76bc5b",
    measurementId: "G-N9XFXYGYP6"
};

// Ініціалізуємо Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const dataDocRef = doc(db, "walletData", "user_wallet");

// Локальний стан програми
let appData = { sources: [], transactions: [], debts: [], settings: { budget: 0, isDark: false } };

let currentOpType = 'expense'; 
let currentDebtType = 'they_owe_me'; 
let currentRepayDebtId = null;

// Функція збереження в хмару
async function saveData() {
    try {
        await setDoc(dataDocRef, appData);
    } catch (error) {
        console.error("Помилка збереження в Firebase:", error);
    }
}

// СЛУХАЧ ХМАРИ (Синхронізація в реальному часі)
onSnapshot(dataDocRef, (docSnap) => {
    if (docSnap.exists()) {
        appData = docSnap.data();
        if (!appData.sources) appData.sources = [];
        if (!appData.transactions) appData.transactions = [];
        if (!appData.debts) appData.debts = [];
        if (!appData.settings) appData.settings = { budget: 0, isDark: false };
    } else {
        appData = { sources: [], transactions: [], debts: [], settings: { budget: 0, isDark: false } };
        saveData();
    }
    
    applyTheme();
    
    // Оновлюємо активний екран
    const activeContainer = document.querySelector('.container.active');
    if (activeContainer) {
        const tabId = activeContainer.id;
        updateSelects();
        if (tabId === 'sourcesTab') renderSources();
        if (tabId === 'debtsTab') renderDebts();
        if (tabId === 'monitoringTab') renderMonitoring();
    } else {
        updateSelects();
        renderSources();
    }
});

// Експортуємо функції для HTML кнопок
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.addSource = addSource;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEditedSource = saveEditedSource;
window.deleteSource = deleteSource;
window.setOpType = setOpType;
window.submitOperation = submitOperation;
window.setDebtType = setDebtType;
window.addDebt = addDebt;
window.openRepayModal = openRepayModal;
window.closeRepayModal = closeRepayModal;
window.confirmRepay = confirmRepay;
window.setBudget = setBudget;
window.renderMonitoring = renderMonitoring;

// --- ТЕМНА ТЕМА ---
function applyTheme() {
    if (appData.settings.isDark) {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').innerText = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('themeToggle').innerText = '🌙';
    }
}

function toggleTheme() {
    appData.settings.isDark = !appData.settings.isDark;
    applyTheme(); saveData();
}

// --- НАВІГАЦІЯ ---
function switchTab(tabId, title) {
    document.querySelectorAll('.container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.getElementById('nav-' + tabId).classList.add('active');
    document.getElementById('pageTitle').innerText = title;
    
    updateSelects();
    if (tabId === 'sourcesTab') renderSources();
    if (tabId === 'debtsTab') renderDebts();
    if (tabId === 'monitoringTab') renderMonitoring();
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'});
}

// --- ДЖЕРЕЛА ---
function getSourceBalance(sourceId) {
    const source = appData.sources.find(s => s.id === sourceId);
    if (!source) return 0;
    let balance = source.initialBalance;
    appData.transactions.forEach(t => {
        if (t.sourceId === sourceId) {
            if (t.type === 'income') balance += t.amount;
            if (t.type === 'expense' || t.type === 'transfer') balance -= t.amount;
        }
        if (t.type === 'transfer' && t.toSourceId === sourceId) {
            balance += t.amount;
        }
    });
    return balance;
}

function addSource() {
    const name = document.getElementById('sourceName').value.trim();
    const desc = document.getElementById('sourceDesc').value.trim();
    const initBal = parseFloat(document.getElementById('sourceInitBalance').value) || 0;
    const color = document.getElementById('sourceColor').value;

    if (!name) return alert('Введіть назву!');

    appData.sources.push({ id: Date.now().toString(), name, description: desc, initialBalance: initBal, theme: color });
    document.getElementById('sourceName').value = ''; document.getElementById('sourceDesc').value = ''; document.getElementById('sourceInitBalance').value = '';
    saveData();
}

function renderSources() {
    const list = document.getElementById('sourcesList');
    if (!list) return;
    list.innerHTML = '';
    if (appData.sources.length === 0) { list.innerHTML = '<div class="empty-state">Додайте свою першу картку або гаманець.</div>'; return; }

    appData.sources.forEach(src => {
        const bal = getSourceBalance(src.id);
        const themeClass = src.theme ? `theme-${src.theme}` : 'theme-black';
        list.innerHTML += `
            <div class="source-card ${themeClass}">
                <div class="source-info">
                    <span class="source-name">${src.name}</span>
                    <span class="source-desc">${src.description}</span>
                    <button class="source-edit" onclick="openEditModal('${src.id}')">⚙️ Налаштувати</button>
                </div>
                <div class="source-balance">${bal} ₴</div>
            </div>`;
    });
}

function openEditModal(id) {
    const src = appData.sources.find(s => s.id === id);
    if(!src) return;
    document.getElementById('editSourceId').value = src.id;
    document.getElementById('editSourceName').value = src.name;
    document.getElementById('editSourceDesc').value = src.description;
    document.getElementById('editSourceBalance').value = src.initialBalance;
    document.getElementById('editSourceColor').value = src.theme || 'black';
    document.getElementById('editSourceModal').classList.add('active');
}

function closeEditModal() { document.getElementById('editSourceModal').classList.remove('active'); }

function saveEditedSource() {
    const id = document.getElementById('editSourceId').value;
    const src = appData.sources.find(s => s.id === id);
    if(!src) return;
    src.name = document.getElementById('editSourceName').value.trim() || src.name;
    src.description = document.getElementById('editSourceDesc').value.trim();
    src.initialBalance = parseFloat(document.getElementById('editSourceBalance').value) || 0;
    src.theme = document.getElementById('editSourceColor').value;
    closeEditModal(); saveData();
}

function deleteSource() {
    if(!confirm('Видалити джерело? Історія операцій залишиться.')) return;
    const id = document.getElementById('editSourceId').value;
    appData.sources = appData.sources.filter(s => s.id !== id);
    closeEditModal(); saveData();
}

function updateSelects() {
    const opts = '<option value="">-- Виберіть джерело --</option>' + appData.sources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    ['opSourceSelect', 'opSourceTo', 'debtSourceSelect', 'repaySourceSelect'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = opts;
    });
    const monSelect = document.getElementById('monFilterSource');
    if(monSelect) {
        const val = monSelect.value;
        monSelect.innerHTML = '<option value="all">Усі джерела</option>' + appData.sources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        if(val) monSelect.value = val;
    }
}

// --- ОПЕРАЦІЇ ТА ПЕРЕКАЗИ ---
function setOpType(type) {
    currentOpType = type;
    document.getElementById('segOpExpense').classList.toggle('active', type === 'expense');
    document.getElementById('segOpIncome').classList.toggle('active', type === 'income');
    document.getElementById('segOpTransfer').classList.toggle('active', type === 'transfer');

    document.getElementById('opSourceSelect').options[0].text = type === 'transfer' ? '-- Звідки (Відправник) --' : '-- З якого джерела? --';
    document.getElementById('opSourceTo').style.display = type === 'transfer' ? 'block' : 'none';
    document.getElementById('opCategory').style.display = type === 'transfer' ? 'none' : 'block';
    
    const btn = document.getElementById('opSubmitBtn');
    btn.className = type === 'expense' ? 'btn btn-red' : (type === 'income' ? 'btn btn-green' : 'btn btn-purple');
    btn.innerText = type === 'expense' ? 'Додати витрату' : (type === 'income' ? 'Додати дохід' : 'Зробити переказ');
}

function submitOperation() {
    const sourceId = document.getElementById('opSourceSelect').value;
    const toSourceId = document.getElementById('opSourceTo').value;
    const category = document.getElementById('opCategory').value;
    const desc = document.getElementById('opDesc').value.trim();
    const amount = parseFloat(document.getElementById('opAmount').value);

    if (!sourceId || !amount || amount <= 0) return alert('Заповніть джерело та коректну суму!');
    if (currentOpType === 'transfer') {
        if (!toSourceId) return alert('Виберіть, куди переказати гроші!');
        if (sourceId === toSourceId) return alert('Не можна переказати на ту саму картку!');
        if (amount > getSourceBalance(sourceId)) if(!confirm('Недостатньо коштів. Продовжити?')) return;
        
        appData.transactions.push({ id: Date.now().toString(), sourceId, toSourceId, description: desc || 'Внутрішній переказ', amount, type: 'transfer', date: new Date().toISOString() });
    } else {
        if (currentOpType === 'expense' && amount > getSourceBalance(sourceId)) if(!confirm('Баланс піде в мінус. Продовжити?')) return;
        appData.transactions.push({ id: Date.now().toString(), sourceId, category, description: desc || category, amount, type: currentOpType, date: new Date().toISOString() });
    }

    document.getElementById('opDesc').value = ''; document.getElementById('opAmount').value = '';
    document.getElementById('opSourceSelect').value = ''; document.getElementById('opSourceTo').value = '';
    saveData(); alert('Успішно!');
}

// --- БОРГИ ---
function setDebtType(type) {
    currentDebtType = type;
    document.getElementById('segDebtThey').classList.toggle('active', type === 'they_owe_me');
    document.getElementById('segDebtMe').classList.toggle('active', type === 'i_owe');
    
    document.getElementById('debtFormTitle').innerText = type === 'they_owe_me' ? 'Дати в борг' : 'Взяти в борг';
    document.getElementById('debtPerson').placeholder = type === 'they_owe_me' ? "Кому даємо?" : "У кого беремо?";
    document.getElementById('debtSourceSelect').options[0].text = type === 'they_owe_me' ? "-- Звідки знімаємо гроші? --" : "-- Куди кладемо гроші? --";
    renderDebts();
}

function addDebt() {
    const person = document.getElementById('debtPerson').value.trim();
    const sourceId = document.getElementById('debtSourceSelect').value;
    const amount = parseFloat(document.getElementById('debtAmount').value);

    if (!person || !sourceId || !amount || amount <= 0) return alert('Заповніть всі поля!');

    if (currentDebtType === 'they_owe_me') { 
        if (amount > getSourceBalance(sourceId)) if(!confirm('Недостатньо коштів на джерелі! Продовжити?')) return;
        appData.transactions.push({ id: Date.now().toString(), sourceId, category: 'Борг', description: `Дав у борг: ${person}`, amount, type: 'expense', date: new Date().toISOString() });
    } else { 
        appData.transactions.push({ id: Date.now().toString(), sourceId, category: 'Борг', description: `Взяв у борг: ${person}`, amount, type: 'income', date: new Date().toISOString() });
    }

    appData.debts.push({ id: Date.now().toString() + "D", person, remainingAmount: amount, type: currentDebtType, date: new Date().toISOString() });
    document.getElementById('debtPerson').value = ''; document.getElementById('debtAmount').value = ''; document.getElementById('debtSourceSelect').value = '';
    saveData();
}

function renderDebts() {
    const list = document.getElementById('debtsList');
    const totalLabel = document.getElementById('totalDebtsLabel');
    if (!list || !totalLabel) return;
    
    let totalOwed = 0; list.innerHTML = '';

    const filteredDebts = appData.debts.filter(d => d.type === currentDebtType);

    if (filteredDebts.length === 0) {
        list.innerHTML = `<div class="empty-state">${currentDebtType === 'they_owe_me' ? 'Ніхто не винен вам грошей.' : 'Ура, у вас немає боргів!'}</div>`;
    } else {
        filteredDebts.forEach(debt => {
            totalOwed += debt.remainingAmount;
            list.innerHTML += `
                <div class="list-item">
                    <div class="list-info">
                        <span class="list-title">👤 ${debt.person}</span>
                        <span class="list-date">Дата: ${formatDate(debt.date)}</span>
                    </div>
                    <div class="right-side">
                        <span class="list-amount ${currentDebtType === 'they_owe_me' ? 'text-orange' : 'text-red'}">${debt.remainingAmount} ₴</span>
                        <button class="edit-icon" style="color:var(--text-main)" onclick="openRepayModal('${debt.id}')">Віддати / Повернути</button>
                    </div>
                </div>`;
        });
    }
    totalLabel.innerText = `Сума: ${totalOwed} ₴`;
    totalLabel.className = currentDebtType === 'they_owe_me' ? 'total-badge text-orange' : 'total-badge text-red';
}

function openRepayModal(debtId) {
    currentRepayDebtId = debtId;
    const debt = appData.debts.find(d => d.id === debtId);
    document.getElementById('repayModalTitle').innerText = debt.type === 'they_owe_me' ? 'Вам повертають борг' : 'Ви віддаєте свій борг';
    document.getElementById('repayPersonName').innerText = `👤 ${debt.person} (Залишок: ${debt.remainingAmount} ₴)`;
    document.getElementById('repaySourceSelect').options[0].text = debt.type === 'they_owe_me' ? '-- Куди зарахувати гроші? --' : '-- Звідки зняти гроші? --';
    document.getElementById('repayAmount').value = ''; document.getElementById('repaySourceSelect').value = '';
    document.getElementById('repayModal').classList.add('active');
}

function closeRepayModal() { document.getElementById('repayModal').classList.remove('active'); }

function confirmRepay() {
    const amount = parseFloat(document.getElementById('repayAmount').value);
    const sourceId = document.getElementById('repaySourceSelect').value;
    if (!amount || amount <= 0 || !sourceId) return alert('Заповніть суму та виберіть джерело!');
    
    const debtIndex = appData.debts.findIndex(d => d.id === currentRepayDebtId);
    if (debtIndex === -1) return closeRepayModal();
    const debt = appData.debts[debtIndex];

    if (amount > debt.remainingAmount) return alert('Сума більша за борг!');

    if (debt.type === 'they_owe_me') { 
        appData.transactions.push({ id: Date.now().toString(), sourceId, category: 'Борг', description: `Повернення від: ${debt.person}`, amount, type: 'income', date: new Date().toISOString() });
    } else { 
        if (amount > getSourceBalance(sourceId)) if(!confirm('Недостатньо коштів! Продовжити?')) return;
        appData.transactions.push({ id: Date.now().toString(), sourceId, category: 'Борг', description: `Я віддав борг для: ${debt.person}`, amount, type: 'expense', date: new Date().toISOString() });
    }

    debt.remainingAmount -= amount;
    if (debt.remainingAmount <= 0) appData.debts.splice(debtIndex, 1);
    closeRepayModal(); saveData();
}

// --- АНАЛІТИКА ТА БЮДЖЕТ ---
function setBudget() {
    const limit = prompt("Введіть ваш ліміт витрат на місяць (грн):", appData.settings.budget || 0);
    if (limit !== null && !isNaN(limit)) {
        appData.settings.budget = parseFloat(limit);
        saveData();
    }
}

function renderMonitoring() {
    const filterSource = document.getElementById('monFilterSource').value;
    const filterType = document.getElementById('monFilterType').value;
    const list = document.getElementById('monitoringList');
    
    let spentThisMonth = 0;
    const currentMonth = new Date().getMonth();
    
    let filteredTxs = [...appData.transactions];
    if (filterSource !== 'all') filteredTxs = filteredTxs.filter(t => t.sourceId === filterSource || t.toSourceId === filterSource);
    if (filterType !== 'all') filteredTxs = filteredTxs.filter(t => t.type === filterType);

    let displayBalance = 0;
    if (filterSource === 'all') appData.sources.forEach(src => { displayBalance += getSourceBalance(src.id); });
    else displayBalance = getSourceBalance(filterSource);

    document.getElementById('monTotalBalance').innerText = `${displayBalance} ₴`;
    list.innerHTML = '';

    filteredTxs.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredTxs.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.type === 'expense' && txDate.getMonth() === currentMonth) spentThisMonth += tx.amount;

        const source = appData.sources.find(s => s.id === tx.sourceId);
        let sourceName = source ? source.name : 'Видалене джерело';
        
        let color, sign, txTitle = tx.description;
        if (tx.type === 'income') { color = 'text-green'; sign = '+'; }
        else if (tx.type === 'expense') { color = 'text-red'; sign = '-'; }
        else { 
            color = 'text-purple'; sign = '⇄'; 
            const toSource = appData.sources.find(s => s.id === tx.toSourceId);
            sourceName = `${sourceName} ➔ ${toSource ? toSource.name : 'Видалене'}`;
        }

        const categoryTag = tx.category && tx.type !== 'transfer' ? `<span class="list-category">${tx.category}</span>` : '';

        list.innerHTML += `
            <div class="list-item">
                <div class="list-info">
                    <span class="list-title">${txTitle}</span>
                    <div>${categoryTag} <span class="list-date">${formatDate(tx.date)}</span></div>
                    <span class="list-desc" style="margin-top:4px;">${sourceName}</span>
                </div>
                <div class="list-amount ${color}">${sign} ${tx.amount} ₴</div>
            </div>`;
    });

    if (filteredTxs.length === 0) list.innerHTML = '<div class="empty-state">Операцій не знайдено.</div>';

    const limit = appData.settings.budget || 0;
    document.getElementById('budgetSpent').innerText = `Витрачено: ${spentThisMonth} ₴`;
    document.getElementById('budgetTotal').innerText = `Ліміт: ${limit > 0 ? limit : 'Не вказано'} ₴`;
    const progressFill = document.getElementById('budgetProgress');
    if (limit > 0) {
        let percent = (spentThisMonth / limit) * 100;
        if (percent > 100) percent = 100;
        progressFill.style.width = `${percent}%`;
        progressFill.className = percent >= 90 ? 'progress-fill danger' : 'progress-fill';
    } else {
        progressFill.style.width = '0%';
    }
}

window.onload = () => { 
    // Initial fetch handled by onSnapshot
    setOpType('expense'); setDebtType('they_owe_me');
};