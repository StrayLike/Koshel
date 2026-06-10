let appData = JSON.parse(localStorage.getItem('ogogo_pro')) || { 
    sources: [], transactions: [], debts: [], settings: { budget: 0, isDark: false }, subscriptions: []
};
if (!appData.settings) appData.settings = { budget: 0, isDark: false };
if (!appData.subscriptions) appData.subscriptions = [];

let currentOpType = 'expense';
let currentDebtType = 'they_owe_me';
let currentRepayDebtId = null;

let exchangeRates = { UAH: 1, USD: 40.0, EUR: 43.0 };
const currencySymbols = { UAH: '₴', USD: '$', EUR: '€' };

function saveData() { localStorage.setItem('ogogo_pro', JSON.stringify(appData)); }

async function fetchRates() {
    try {
        const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
        const data = await res.json();
        const usd = data.find(c => c.cc === 'USD');
        const eur = data.find(c => c.cc === 'EUR');
        if (usd) exchangeRates.USD = usd.rate;
        if (eur) exchangeRates.EUR = eur.rate;
    } catch (e) {
        console.log('Курси завантажено з кешу.');
    }
    if(document.getElementById('monitoringTab').classList.contains('active')) renderMonitoring();
}

function checkSubscriptions() {
    const today = new Date();
    const currentMonthKey = today.getFullYear() + '-' + today.getMonth(); 
    let processedCount = 0;
    appData.subscriptions.forEach(sub => {
        if (today.getDate() >= sub.day && sub.lastPaid !== currentMonthKey) {
            appData.transactions.push({ id: Date.now().toString() + Math.random(), sourceId: sub.sourceId, category: sub.category, description: `🔄 Автоплатіж: ${sub.name}`, amount: sub.amount, type: 'expense', date: new Date().toISOString() });
            sub.lastPaid = currentMonthKey; processedCount++;
        }
    });
    if (processedCount > 0) { saveData(); alert(`Списано ${processedCount} регулярних платежів.`); }
}

function exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ogogo_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData.sources && importedData.transactions) { appData = importedData; saveData(); alert('Відновлено!'); location.reload(); } else { alert('Помилка файлу!'); }
        } catch (err) { alert('Помилка читання!'); }
    };
    reader.readAsText(file); event.target.value = ''; 
}

function applyTheme() {
    if (appData.settings.isDark) { document.body.classList.add('dark-mode'); document.getElementById('themeToggle').innerText = '☀️'; } 
    else { document.body.classList.remove('dark-mode'); document.getElementById('themeToggle').innerText = '🌙'; }
}
function toggleTheme() { appData.settings.isDark = !appData.settings.isDark; applyTheme(); saveData(); }

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

function formatDate(isoString) { const d = new Date(isoString); return d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'}); }

function getSourceBalance(sourceId) {
    const source = appData.sources.find(s => s.id === sourceId);
    if (!source) return 0;
    let balance = source.initialBalance || 0;
    appData.transactions.forEach(t => {
        if (t.sourceId === sourceId) { if (t.type === 'income') balance += t.amount; if (t.type === 'expense' || t.type === 'transfer') balance -= t.amount; }
        if (t.type === 'transfer' && t.toSourceId === sourceId) { balance += t.amount; }
    });
    return balance;
}

function addSource() {
    const name = document.getElementById('sourceName').value.trim(); const desc = document.getElementById('sourceDesc').value.trim();
    const initBal = parseFloat(document.getElementById('sourceInitBalance').value) || 0;
    const color = document.getElementById('sourceColor').value; const currency = document.getElementById('sourceCurrency').value;
    if (!name) return alert('Введіть назву!');
    appData.sources.push({ id: Date.now().toString(), name, description: desc, initialBalance: initBal, theme: color, currency: currency, isGoal: false });
    document.getElementById('sourceName').value = ''; document.getElementById('sourceInitBalance').value = '';
    document.getElementById('addSourceModal').classList.remove('active'); saveData(); renderSources(); updateSelects();
}

function addGoal() {
    const name = document.getElementById('goalName').value.trim(); const desc = document.getElementById('goalDesc').value.trim();
    const target = parseFloat(document.getElementById('goalTarget').value);
    if (!name || !target || target <= 0) return alert('Введіть суму!');
    appData.sources.push({ id: Date.now().toString(), name, description: desc, initialBalance: 0, targetAmount: target, isGoal: true, currency: 'UAH', theme: 'goal' });
    document.getElementById('goalName').value = ''; document.getElementById('goalTarget').value = '';
    document.getElementById('addGoalModal').classList.remove('active'); saveData(); renderSources(); updateSelects();
}

function renderSources() {
    const listCards = document.getElementById('sourcesList'); const listGoals = document.getElementById('goalsList');
    listCards.innerHTML = ''; listGoals.innerHTML = ''; let hasCards = false; let hasGoals = false;

    appData.sources.forEach(src => {
        const bal = getSourceBalance(src.id); const sym = currencySymbols[src.currency || 'UAH'];
        if (src.isGoal) {
            hasGoals = true; let percent = (bal / src.targetAmount) * 100; if (percent > 100) percent = 100;
            listGoals.innerHTML += `<div class="card" style="padding: 16px; border: 1px solid var(--purple);"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><div><div style="font-weight: 600; font-size: 16px;">${src.name}</div><div style="font-size: 12px; color: var(--text-muted);">${src.description}</div></div><button class="icon-btn text-muted" style="font-size: 16px;" onclick="openEditModal('${src.id}')">⚙️</button></div><div class="progress-bg" style="background: rgba(175, 82, 222, 0.2); height: 16px;"><div class="progress-fill" style="width: ${percent}%; background: var(--purple);"></div></div><div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 8px; font-weight: 600;"><span class="text-purple">${bal} ${sym}</span><span style="color: var(--text-muted);">із ${src.targetAmount} ${sym}</span></div></div>`;
        } else {
            hasCards = true; const themeClass = src.theme ? `theme-${src.theme}` : 'theme-black';
            listCards.innerHTML += `<div class="source-card ${themeClass}"><div class="source-info"><span class="source-name">${src.name}</span><span class="source-desc">${src.description}</span><button class="source-edit" onclick="openEditModal('${src.id}')">⚙️ Налаштувати</button></div><div class="source-balance">${sym}${bal}</div></div>`;
        }
    });
    if (!hasCards) listCards.innerHTML = '<div class="empty-state">Немає карток.</div>';
    if (!hasGoals) listGoals.innerHTML = '<div class="empty-state">Немає цілей.</div>';
}

function openEditModal(id) {
    const src = appData.sources.find(s => s.id === id); if(!src) return;
    document.getElementById('editSourceId').value = src.id; document.getElementById('editSourceName').value = src.name; document.getElementById('editSourceDesc').value = src.description;
    if(src.isGoal) { document.getElementById('editSourceBalance').value = src.targetAmount; document.getElementById('editTargetLabel').innerText = "Цільова сума"; document.getElementById('editSourceColor').value = 'goal'; } 
    else { document.getElementById('editSourceBalance').value = src.initialBalance; document.getElementById('editTargetLabel').innerText = "Початковий баланс"; document.getElementById('editSourceColor').value = src.theme || 'black'; }
    document.getElementById('editSourceCurrency').value = src.currency || 'UAH'; document.getElementById('editSourceModal').classList.add('active');
}
function closeEditModal() { document.getElementById('editSourceModal').classList.remove('active'); }
function saveEditedSource() {
    const id = document.getElementById('editSourceId').value; const src = appData.sources.find(s => s.id === id); if(!src) return;
    src.name = document.getElementById('editSourceName').value.trim() || src.name; src.description = document.getElementById('editSourceDesc').value.trim();
    const numValue = parseFloat(document.getElementById('editSourceBalance').value) || 0;
    if(src.isGoal) src.targetAmount = numValue; else src.initialBalance = numValue;
    src.currency = document.getElementById('editSourceCurrency').value; if (!src.isGoal) src.theme = document.getElementById('editSourceColor').value;
    saveData(); closeEditModal(); renderSources(); updateSelects();
}
function deleteSource() {
    if(!confirm('Видалити? Історія операцій збережеться.')) return;
    const id = document.getElementById('editSourceId').value; appData.sources = appData.sources.filter(s => s.id !== id);
    saveData(); closeEditModal(); renderSources(); updateSelects();
}

function updateSelects() {
    const optsCards = '<option value="">-- Картки та Гаманці --</option>' + appData.sources.filter(s => !s.isGoal).map(s => `<option value="${s.id}">💳 ${s.name}</option>`).join('');
    const optsGoals = appData.sources.some(s => s.isGoal) ? '<option disabled>-- Скарбнички --</option>' + appData.sources.filter(s => s.isGoal).map(s => `<option value="${s.id}">🎯 ${s.name}</option>`).join('') : '';
    const allOpts = optsCards + optsGoals;
    ['opSourceSelect', 'opSourceTo', 'debtSourceSelect', 'repaySourceSelect', 'subSourceSelect', 'editTxSourceSelect'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = allOpts; });
    const monSelect = document.getElementById('monFilterSource'); if(monSelect) { const val = monSelect.value; monSelect.innerHTML = '<option value="all">Усі джерела</option>' + allOpts; if(val) monSelect.value = val; }
}

function setOpType(type) {
    currentOpType = type;
    document.getElementById('segOpExpense').classList.toggle('active', type === 'expense'); document.getElementById('segOpIncome').classList.toggle('active', type === 'income'); document.getElementById('segOpTransfer').classList.toggle('active', type === 'transfer');
    document.getElementById('opSourceSelect').options[0].text = type === 'transfer' ? '-- Звідки знімаємо? --' : '-- З якого джерела? --';
    document.getElementById('opSourceTo').style.display = type === 'transfer' ? 'block' : 'none'; document.getElementById('opCategory').style.display = type === 'transfer' ? 'none' : 'block';
    const btn = document.getElementById('opSubmitBtn'); btn.className = type === 'expense' ? 'btn btn-red' : (type === 'income' ? 'btn btn-green' : 'btn btn-purple'); btn.innerText = type === 'expense' ? 'Додати витрату' : (type === 'income' ? 'Додати дохід' : 'Зробити переказ');
}

function submitOperation() {
    const sourceId = document.getElementById('opSourceSelect').value; const toSourceId = document.getElementById('opSourceTo').value;
    const category = document.getElementById('opCategory').value; const desc = document.getElementById('opDesc').value.trim(); const amount = parseFloat(document.getElementById('opAmount').value);
    if (!sourceId || !amount || amount <= 0) return alert('Заповніть суму та джерело!');
    if (currentOpType === 'transfer') {
        if (!toSourceId || sourceId === toSourceId) return alert('Виберіть інший рахунок.');
        appData.transactions.push({ id: Date.now().toString(), sourceId, toSourceId, description: desc || 'Переказ', amount, type: 'transfer', date: new Date().toISOString() });
    } else { appData.transactions.push({ id: Date.now().toString(), sourceId, category, description: desc || category, amount, type: currentOpType, date: new Date().toISOString() }); }
    document.getElementById('opDesc').value = ''; document.getElementById('opAmount').value = ''; saveData(); alert('Успішно!');
}

window.openEditTxModal = function(txId) {
    const tx = appData.transactions.find(t => t.id === txId); if (!tx) return;
    document.getElementById('editTxId').value = tx.id; document.getElementById('editTxSourceSelect').value = tx.sourceId;
    document.getElementById('editTxCategory').value = tx.category || "Інше"; document.getElementById('editTxDesc').value = tx.description || ""; document.getElementById('editTxAmount').value = tx.amount;
    document.getElementById('editTxCategory').style.display = tx.type === 'transfer' ? 'none' : 'block'; document.getElementById('editTxModal').classList.add('active');
};
window.closeEditTxModal = function() { document.getElementById('editTxModal').classList.remove('active'); };
window.saveEditedTx = function() {
    const id = document.getElementById('editTxId').value; const tx = appData.transactions.find(t => t.id === id); if (!tx) return;
    tx.sourceId = document.getElementById('editTxSourceSelect').value; if(tx.type !== 'transfer') tx.category = document.getElementById('editTxCategory').value;
    tx.description = document.getElementById('editTxDesc').value.trim(); tx.amount = parseFloat(document.getElementById('editTxAmount').value) || 0;
    saveData(); closeEditTxModal(); renderMonitoring(); renderSources();
};
window.deleteTx = function() {
    if (!confirm('Видалити операцію?')) return;
    const id = document.getElementById('editTxId').value; appData.transactions = appData.transactions.filter(t => t.id !== id);
    saveData(); closeEditTxModal(); renderMonitoring(); renderSources();
};

function setDebtType(type) {
    currentDebtType = type;
    document.getElementById('segDebtThey').classList.toggle('active', type === 'they_owe_me'); document.getElementById('segDebtMe').classList.toggle('active', type === 'i_owe');
    document.getElementById('debtFormTitle').innerText = type === 'they_owe_me' ? 'Дати в борг' : 'Взяти в борг'; document.getElementById('debtPerson').placeholder = type === 'they_owe_me' ? "Кому даємо?" : "У кого беремо?"; renderDebts();
}

function addDebt() {
    const person = document.getElementById('debtPerson').value.trim(); const sourceId = document.getElementById('debtSourceSelect').value; const amount = parseFloat(document.getElementById('debtAmount').value);
    if (!person || !sourceId || !amount || amount <= 0) return alert('Заповніть всі поля!');
    const type = currentDebtType === 'they_owe_me' ? 'expense' : 'income'; const desc = currentDebtType === 'they_owe_me' ? `Дав у борг: ${person}` : `Взяв у борг: ${person}`;
    appData.transactions.push({ id: Date.now().toString(), sourceId, category: 'Борг', description: desc, amount, type: type, date: new Date().toISOString() });
    appData.debts.push({ id: Date.now().toString() + "D", person, remainingAmount: amount, type: currentDebtType, sourceId: sourceId, date: new Date().toISOString() });
    document.getElementById('debtPerson').value = ''; document.getElementById('debtAmount').value = ''; saveData(); renderDebts();
}

function renderDebts() {
    const list = document.getElementById('debtsList'); let totalOwed = 0; list.innerHTML = '';
    const filteredDebts = appData.debts.filter(d => d.type === currentDebtType);
    if (filteredDebts.length === 0) { list.innerHTML = '<div class="empty-state">Боргів немає.</div>'; } 
    else {
        filteredDebts.forEach(debt => {
            const source = appData.sources.find(s => s.id === debt.sourceId); const sym = currencySymbols[source?.currency || 'UAH']; totalOwed += debt.remainingAmount;
            list.innerHTML += `<div class="list-item"><div class="list-info"><span class="list-title">👤 ${debt.person}</span><span class="list-date">Дата: ${formatDate(debt.date)}</span></div><div class="right-side"><span class="list-amount ${currentDebtType === 'they_owe_me' ? 'text-orange' : 'text-red'}">${debt.remainingAmount} ${sym}</span><button class="edit-icon" onclick="openRepayModal('${debt.id}')">Редагувати</button></div></div>`;
        });
    }
    document.getElementById('totalDebtsLabel').innerText = `Сума: ${totalOwed}`; document.getElementById('totalDebtsLabel').className = currentDebtType === 'they_owe_me' ? 'total-badge text-orange' : 'total-badge text-red';
}

function openRepayModal(debtId) {
    currentRepayDebtId = debtId; const debt = appData.debts.find(d => d.id === debtId);
    document.getElementById('repayDebtId').value = debt.id; document.getElementById('repayPersonName').innerText = `👤 ${debt.person} (Залишок: ${debt.remainingAmount})`;
    document.getElementById('repayAmount').value = ''; document.getElementById('repayModal').classList.add('active');
}
function closeRepayModal() { document.getElementById('repayModal').classList.remove('active'); }
function confirmRepay() {
    const amount = parseFloat(document.getElementById('repayAmount').value); const sourceId = document.getElementById('repaySourceSelect').value;
    if (!amount || amount <= 0 || !sourceId) return alert('Заповніть поля!');
    const debtIndex = appData.debts.findIndex(d => d.id === currentRepayDebtId); if (debtIndex === -1) return closeRepayModal();
    const debt = appData.debts[debtIndex];
    if (amount > debt.remainingAmount) return alert('Сума більша за залишок!');
    const type = debt.type === 'they_owe_me' ? 'income' : 'expense'; const desc = debt.type === 'they_owe_me' ? `Повернення від: ${debt.person}` : `Віддав борг: ${debt.person}`;
    appData.transactions.push({ id: Date.now().toString(), sourceId, category: 'Борг', description: desc, amount, type: type, date: new Date().toISOString() });
    debt.remainingAmount -= amount; if (debt.remainingAmount <= 0) appData.debts.splice(debtIndex, 1);
    saveData(); closeRepayModal(); renderDebts(); renderSources();
}
window.deleteDebtEntirely = function() {
    if (!confirm('Видалити борг?')) return;
    const id = document.getElementById('repayDebtId').value; appData.debts = appData.debts.filter(d => d.id !== id);
    saveData(); closeRepayModal(); renderDebts();
};

function openSubsModal() {
    const list = document.getElementById('subsList'); list.innerHTML = '';
    if (appData.subscriptions.length === 0) { list.innerHTML = '<div class="empty-state">Немає автоплатежів.</div>'; } 
    else {
        appData.subscriptions.forEach((sub, index) => {
            const source = appData.sources.find(s => s.id === sub.sourceId); const sym = currencySymbols[source?.currency || 'UAH'];
            list.innerHTML += `<div class="list-item"><div class="list-info"><span class="list-title">${sub.name}</span><span class="list-desc">Кожного ${sub.day}-го числа</span></div><div class="right-side"><span class="list-amount text-red">-${sub.amount} ${sym}</span><button class="edit-icon" onclick="deleteSubscription(${index})">Видалити</button></div></div>`;
        });
    }
    document.getElementById('subsListModal').classList.add('active');
}
function openAddSubModal() { document.getElementById('subsListModal').classList.remove('active'); document.getElementById('addSubModal').classList.add('active'); }
function addSubscription() {
    const name = document.getElementById('subName').value.trim(); const sourceId = document.getElementById('subSourceSelect').value;
    const category = document.getElementById('subCategory').value; const amount = parseFloat(document.getElementById('subAmount').value); const day = parseInt(document.getElementById('subDay').value);
    if (!name || !sourceId || !amount || !day || day < 1 || day > 31) return alert('Помилка вводу!');
    appData.subscriptions.push({ id: Date.now().toString(), name, sourceId, category, amount, day, lastPaid: null });
    document.getElementById('subName').value = ''; document.getElementById('subAmount').value = ''; document.getElementById('addSubModal').classList.remove('active'); saveData(); alert('Створено!');
}
function deleteSubscription(index) { if(!confirm('Видалити?')) return; appData.subscriptions.splice(index, 1); saveData(); openSubsModal(); }

function setBudget() {
    const limit = prompt("Введіть ваш ліміт (у гривнях):", appData.settings.budget || 0);
    if (limit !== null && !isNaN(limit)) { appData.settings.budget = parseFloat(limit); saveData(); renderMonitoring(); }
}

function renderMonitoring() {
    const filterSource = document.getElementById('monFilterSource').value; const filterType = document.getElementById('monFilterType').value;
    const list = document.getElementById('monitoringList'); const reportList = document.getElementById('categoriesReportList');
    
    let spentThisMonthUah = 0; const currentMonth = new Date().getMonth();
    let filteredTxs = [...appData.transactions];
    
    if (filterSource !== 'all') filteredTxs = filteredTxs.filter(t => t.sourceId === filterSource || t.toSourceId === filterSource);
    if (filterType !== 'all') filteredTxs = filteredTxs.filter(t => t.type === filterType);

    let totalBalanceInUah = 0;
    appData.sources.filter(s => !s.isGoal).forEach(src => { 
        let rawBalance = getSourceBalance(src.id);
        if (src.currency === 'USD') totalBalanceInUah += rawBalance * exchangeRates.USD;
        else if (src.currency === 'EUR') totalBalanceInUah += rawBalance * exchangeRates.EUR;
        else totalBalanceInUah += rawBalance;
    });
    document.getElementById('monTotalBalance').innerText = `${Math.round(totalBalanceInUah)} ₴`;

    let categorySums = {}; let daysWithExpenses = new Set();
    
    appData.transactions.forEach(tx => {
        if(tx.type === 'expense') {
            const txDate = new Date(tx.date);
            if(txDate.getMonth() === currentMonth) {
                daysWithExpenses.add(txDate.getDate());
                let txAmountInUah = tx.amount;
                const src = appData.sources.find(s => s.id === tx.sourceId);
                if (src) {
                    if (src.currency === 'USD') txAmountInUah = tx.amount * exchangeRates.USD;
                    if (src.currency === 'EUR') txAmountInUah = tx.amount * exchangeRates.EUR;
                }
                const cat = tx.category || "Інше";
                categorySums[cat] = (categorySums[cat] || 0) + txAmountInUah;
            }
        }
    });

    reportList.innerHTML = '';
    if(Object.keys(categorySums).length === 0) { reportList.innerHTML = '<div style="color:var(--text-muted); font-style:italic;">Немає витрат.</div>'; } 
    else {
        for (let cat in categorySums) {
            reportList.innerHTML += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:4px;"><span>${cat}</span><span style="font-weight:600;" class="text-red">${Math.round(categorySums[cat])} ₴</span></div>`;
        }
    }

    // --- ЛОГІКА ПРОГНОЗУ (ШІ) ---
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysPassed = today.getDate();
    const daysRemaining = daysInMonth - daysPassed;
    
    const forecastEl = document.getElementById('aiForecastText');
    if (spentThisMonthUah === 0 || daysWithExpenses.size === 0) {
        forecastEl.innerText = "У вас ще немає витрат цього місяця. Додайте операції, щоб я міг зробити прогноз!";
    } else {
        const avgSpendPerDay = spentThisMonthUah / daysPassed;
        const predictedFutureSpend = avgSpendPerDay * daysRemaining;
        const predictedBalance = totalBalanceInUah - predictedFutureSpend;
        
        let mood = "👍 Відмінно";
        if (predictedBalance < 0) mood = "⚠️ Обережно";
        
        forecastEl.innerHTML = `Ви витрачаєте в середньому <b>${Math.round(avgSpendPerDay)} ₴</b> на день.<br>
        Очікувані витрати до кінця місяця: <b>~${Math.round(predictedFutureSpend)} ₴</b>.<br>
        ${mood}, ваш прогнозований залишок: <b>${Math.round(predictedBalance)} ₴</b>.`;
    }

    list.innerHTML = ''; filteredTxs.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredTxs.forEach(tx => {
        const source = appData.sources.find(s => s.id === tx.sourceId); const sym = currencySymbols[source?.currency || 'UAH'];
        let txAmountInUah = tx.amount;
        if (source) { if (source.currency === 'USD') txAmountInUah = tx.amount * exchangeRates.USD; if (source.currency === 'EUR') txAmountInUah = tx.amount * exchangeRates.EUR; }
        const txDate = new Date(tx.date); if (tx.type === 'expense' && txDate.getMonth() === currentMonth) spentThisMonthUah += txAmountInUah;

        let sourceName = source ? source.name : 'Видалене'; let color, sign, txTitle = tx.description;
        if (tx.type === 'income') { color = 'text-green'; sign = '+'; }
        else if (tx.type === 'expense') { color = 'text-red'; sign = '-'; }
        else { color = 'text-purple'; sign = '⇄'; const toSource = appData.sources.find(s => s.id === tx.toSourceId); sourceName = `${sourceName} ➔ ${toSource ? toSource.name : 'Видалене'}`; }
        const categoryTag = tx.category && tx.type !== 'transfer' ? `<span class="list-category">${tx.category}</span>` : '';
        list.innerHTML += `<div class="list-item" style="cursor:pointer;" onclick="openEditTxModal('${tx.id}')"><div class="list-info"><span class="list-title">${txTitle}</span><div>${categoryTag} <span class="list-date">${formatDate(tx.date)}</span></div><span class="list-desc" style="margin-top:4px;">${sourceName}</span></div><div class="list-amount ${color}">${sign} ${sym}${tx.amount}</div></div>`;
    });
    if (filteredTxs.length === 0) list.innerHTML = '<div class="empty-state">Операцій не знайдено.</div>';

    const limit = appData.settings.budget || 0;
    document.getElementById('budgetSpent').innerText = `Витрачено: ${Math.round(spentThisMonthUah)} ₴`; document.getElementById('budgetTotal').innerText = `Ліміт: ${limit > 0 ? limit : 'Не вказано'} ₴`;
    const progressFill = document.getElementById('budgetProgress');
    if (limit > 0) { let percent = (spentThisMonthUah / limit) * 100; if (percent > 100) percent = 100; progressFill.style.width = `${percent}%`; progressFill.className = percent >= 90 ? 'progress-fill danger' : 'progress-fill'; } else { progressFill.style.width = '0%'; }
}

window.onload = () => { applyTheme(); updateSelects(); renderSources(); setOpType('expense'); setDebtType('they_owe_me'); fetchRates(); checkSubscriptions(); };
window.toggleTheme = toggleTheme; window.switchTab = switchTab; window.addSource = addSource; window.addGoal = addGoal; window.openEditModal = openEditModal; window.closeEditModal = closeEditModal; window.saveEditedSource = saveEditedSource; window.deleteSource = deleteSource; window.setOpType = setOpType; window.submitOperation = submitOperation; window.setDebtType = setDebtType; window.addDebt = addDebt; window.openRepayModal = openRepayModal; window.closeRepayModal = closeRepayModal; window.confirmRepay = confirmRepay; window.setBudget = setBudget; window.renderMonitoring = renderMonitoring;