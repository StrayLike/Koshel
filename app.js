// Імпортуємо потрібні функції з Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

// Твоя конфігурація Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB5xv6cpjH_Nbrz_BNfGdNSd5CFquBBnus",
  authDomain: "ogooo-a9ba3.firebaseapp.com",
  projectId: "ogooo-a9ba3",
  storageBucket: "ogooo-a9ba3.firebasestorage.app",
  messagingSenderId: "602230576066",
  appId: "1:602230576066:web:1d095a5d535dda5c76bc5b",
  measurementId: "G-N9XFXYGYP6"
};

// Ініціалізуємо Firebase та базу даних Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Створюємо один спільний документ у хмарі для твоїх даних
const dataDocRef = doc(db, "walletData", "user_wallet");

// Локальний стан програми (буде синхронізуватися з хмарою)
let appData = { sources: [], transactions: [], debts: [] };
let currentRepayDebtId = null;

// Функція збереження даних у ХМАРУ Firebase
async function saveData() {
    try {
        await setDoc(dataDocRef, appData);
    } catch (error) {
        console.error("Помилка збереження в Firebase:", error);
    }
}

// СЛУХАЧ ХМАРИ (Live Synchronization):
// Щоразу, коли дані змінюються в базі (з ПК чи з телефона) — екран оновлюється автоматично в реальному часі!
onSnapshot(dataDocRef, (docSnap) => {
    if (docSnap.exists()) {
        appData = docSnap.data();
        // Перевіряємо, щоб масиви завжди існували
        if (!appData.sources) appData.sources = [];
        if (!appData.transactions) appData.transactions = [];
        if (!appData.debts) appData.debts = [];
    } else {
        // Якщо база порожня (перший запуск) — створюємо початкову структуру
        appData = { sources: [], transactions: [], debts: [] };
        saveData();
    }
    
    // Перемальовуємо поточний активний екран новими даними з хмари
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

// Робимо функції доступними для HTML-кнопок (оскільки скрипт став type="module")
window.switchTab = switchTab;
window.addSource = addSource;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEditedSource = saveEditedSource;
window.deleteSource = deleteSource;
window.addTransaction = addTransaction;
window.addDebt = addDebt;
window.openRepayModal = openRepayModal;
window.closeRepayModal = closeRepayModal;
window.confirmRepay = confirmRepay;
window.renderMonitoring = renderMonitoring;

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

/* --- ДЖЕРЕЛА --- */
function getSourceBalance(sourceId) {
    const source = appData.sources.find(s => s.id === sourceId);
    if (!source) return 0;
    let balance = source.initialBalance;
    appData.transactions.forEach(t => {
        if (t.sourceId === sourceId) balance += (t.type === 'income' ? t.amount : -t.amount);
    });
    return balance;
}

function addSource() {
    const name = document.getElementById('sourceName').value.trim();
    const desc = document.getElementById('sourceDesc').value.trim();
    const initBal = parseFloat(document.getElementById('sourceInitBalance').value) || 0;

    if (!name) return alert('Введіть назву джерела!');

    appData.sources.push({ id: Date.now().toString(), name, description: desc, initialBalance: initBal });

    document.getElementById('sourceName').value = '';
    document.getElementById('sourceDesc').value = '';
    document.getElementById('sourceInitBalance').value = '';
    
    saveData();
}

function renderSources() {
    const list = document.getElementById('sourcesList');
    if (!list) return;
    list.innerHTML = '';
    if (appData.sources.length === 0) {
        list.innerHTML = '<div class="empty-state">У вас ще немає доданих джерел.</div>'; return;
    }

    appData.sources.forEach(src => {
        const bal = getSourceBalance(src.id);
        list.innerHTML += `
            <div class="list-item">
                <div class="list-info">
                    <span class="list-title">${src.name}</span>
                    <span class="list-desc">${src.description}</span>
                </div>
                <div class="right-side">
                    <span class="list-amount ${bal >= 0 ? 'text-main' : 'text-red'}">${bal} ₴</span>
                    <button class="edit-icon" onclick="openEditModal('${src.id}')">Редагувати</button>
                </div>
            </div>
        `;
    });
}

/* --- РЕДАГУВАННЯ / ВИДАЛЕННЯ ДЖЕРЕЛ --- */
function openEditModal(id) {
    const src = appData.sources.find(s => s.id === id);
    if(!src) return;
    document.getElementById('editSourceId').value = src.id;
    document.getElementById('editSourceName').value = src.name;
    document.getElementById('editSourceDesc').value = src.description;
    document.getElementById('editSourceBalance').value = src.initialBalance;
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

    closeEditModal();
    saveData();
}

function deleteSource() {
    if(!confirm('Точно видалити це джерело? Історія операцій за ним залишиться, але саме джерело зникне.')) return;
    const id = document.getElementById('editSourceId').value;
    appData.sources = appData.sources.filter(s => s.id !== id);
    closeEditModal();
    saveData();
}

function updateSelects() {
    const opSelect = document.getElementById('opSourceSelect');
    const debtSelect = document.getElementById('debtSourceSelect');
    const repaySelect = document.getElementById('repaySourceSelect');
    const monSelect = document.getElementById('monFilterSource');
    
    if(!opSelect || !debtSelect || !repaySelect || !monSelect) return;
    
    const monCurrentVal = monSelect.value;
    const opts = '<option value="">-- Виберіть джерело --</option>' + appData.sources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    opSelect.innerHTML = opts; debtSelect.innerHTML = opts; repaySelect.innerHTML = opts;
    monSelect.innerHTML = '<option value="all">Усі джерела</option>' + appData.sources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if(monCurrentVal) monSelect.value = monCurrentVal;
}

/* --- ОПЕРАЦІЇ --- */
function addTransaction(type, isDebtInternal = false, forceSourceId = null, forceDesc = null, forceAmount = null) {
    const sourceId = isDebtInternal ? forceSourceId : document.getElementById('opSourceSelect').value;
    const desc = isDebtInternal ? forceDesc : document.getElementById('opDesc').value.trim();
    const amount = isDebtInternal ? forceAmount : parseFloat(document.getElementById('opAmount').value);

    if (!sourceId || !desc || !amount || amount <= 0) {
        if(!isDebtInternal) alert('Заповніть всі поля коректно!'); return;
    }

    appData.transactions.push({ id: Date.now().toString() + Math.random().toString(), sourceId, description: desc, amount, type, date: new Date().toISOString() });

    if(!isDebtInternal) {
        document.getElementById('opDesc').value = ''; document.getElementById('opAmount').value = '';
        document.getElementById('opSourceSelect').value = '';
        saveData();
        alert('Транзакцію успішно додано!');
    }
}

/* --- БОРГИ --- */
function addDebt() {
    const person = document.getElementById('debtPerson').value.trim();
    const sourceId = document.getElementById('debtSourceSelect').value;
    const amount = parseFloat(document.getElementById('debtAmount').value);

    if (!person || !sourceId || !amount || amount <= 0) return alert('Заповніть всі поля!');
    if (amount > getSourceBalance(sourceId)) {
        if(!confirm('Недостатньо коштів на джерелі. Баланс піде в мінус. Продовжити?')) return;
    }

    appData.debts.push({ id: Date.now().toString(), person, remainingAmount: amount, date: new Date().toISOString() });
    addTransaction('expense', true, sourceId, `Борг (${person})`, amount);

    document.getElementById('debtPerson').value = ''; document.getElementById('debtAmount').value = '';
    document.getElementById('debtSourceSelect').value = '';
    saveData();
}

function renderDebts() {
    const list = document.getElementById('debtsList');
    const totalLabel = document.getElementById('totalDebtsLabel');
    if (!list || !totalLabel) return;
    
    let totalOwed = 0; list.innerHTML = '';

    if (appData.debts.length === 0) {
        list.innerHTML = '<div class="empty-state">У вас немає активних боргів.</div>';
    } else {
        appData.debts.forEach(debt => {
            totalOwed += debt.remainingAmount;
            list.innerHTML += `
                <div class="list-item">
                    <div class="list-info">
                        <span class="list-title">👤 ${debt.person}</span>
                        <span class="list-date">Видано: ${formatDate(debt.date)}</span>
                    </div>
                    <div class="right-side">
                        <span class="list-amount text-orange">${debt.remainingAmount} ₴</span>
                        <button class="edit-icon" onclick="openRepayModal('${debt.id}')">Повернути</button>
                    </div>
                </div>`;
        });
    }
    totalLabel.innerText = `Нам винні: ${totalOwed} ₴`;
}

function openRepayModal(debtId) {
    currentRepayDebtId = debtId;
    const debt = appData.debts.find(d => d.id === debtId);
    document.getElementById('repayPersonName').innerText = `Повертає: ${debt.person} (Залишок: ${debt.remainingAmount} ₴)`;
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

    debt.remainingAmount -= amount;
    addTransaction('income', true, sourceId, `Повернення боргу (${debt.person})`, amount);

    if (debt.remainingAmount <= 0) appData.debts.splice(debtIndex, 1);

    closeRepayModal();
    saveData();
}

/* --- МОНІТОРИНГ --- */
function renderMonitoring() {
    const filterSource = document.getElementById('monFilterSource').value;
    const filterType = document.getElementById('monFilterType').value;
    const sortMode = document.getElementById('monSort').value;
    const list = document.getElementById('monitoringList');
    const balanceLabel = document.getElementById('monTotalBalance');
    
    if(!list || !balanceLabel) return;
    
    let filteredTxs = [...appData.transactions];
    if (filterSource !== 'all') filteredTxs = filteredTxs.filter(t => t.sourceId === filterSource);
    if (filterType !== 'all') filteredTxs = filteredTxs.filter(t => t.type === filterType);

    let displayBalance = 0;
    if (filterSource === 'all') appData.sources.forEach(src => { displayBalance += getSourceBalance(src.id); });
    else displayBalance = getSourceBalance(filterSource);

    balanceLabel.innerText = `${displayBalance} ₴`;
    list.innerHTML = '';

    if (filteredTxs.length === 0) { list.innerHTML = '<div class="empty-state">Операцій не знайдено.</div>'; return; }

    if (sortMode === 'dateDesc') filteredTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortMode === 'dateAsc') filteredTxs.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sortMode === 'amountDesc') filteredTxs.sort((a, b) => b.amount - a.amount);
    else if (sortMode === 'amountAsc') filteredTxs.sort((a, b) => a.amount - b.amount);

    filteredTxs.forEach(tx => {
        const source = appData.sources.find(s => s.id === tx.sourceId);
        const sourceName = source ? source.name : 'Видалене джерело';
        const color = tx.type === 'income' ? 'text-green' : 'text-red';
        const sign = tx.type === 'income' ? '+' : '-';

        list.innerHTML += `
            <div class="list-item">
                <div class="list-info">
                    <span class="list-title">${tx.description}</span>
                    <span class="list-desc">${sourceName}</span>
                    <span class="list-date">${formatDate(tx.date)}</span>
                </div>
                <div class="list-amount ${color}">${sign}${tx.amount} ₴</div>
            </div>`;
    });
}