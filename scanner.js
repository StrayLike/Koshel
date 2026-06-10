// scanner.js - Модуль для розпізнавання чеків

async function processReceipt(event) {
    const file = event.target.files[0];
    if (!file) return;

    const amountInput = document.getElementById('opAmount');
    const scanBtn = document.getElementById('scanBtn');
    
    // Показуємо користувачу, що процес пішов
    amountInput.value = '';
    amountInput.placeholder = "Сканую...";
    scanBtn.innerText = "⏳...";
    scanBtn.disabled = true;

    try {
        // Tesseract створює "воркера" для читання (перший раз може зайняти 3-5 секунд для завантаження мови)
        const worker = await Tesseract.createWorker('ukr+eng');
        const ret = await worker.recognize(file);
        const text = ret.data.text;
        
        // Магія: шукаємо всі числа, схожі на гроші (напр. 150.50, 1200,00)
        const matches = text.match(/\d+[.,]\d{2}/g);
        let foundSum = null;

        if (matches) {
            let maxVal = 0;
            matches.forEach(m => {
                let val = parseFloat(m.replace(',', '.'));
                // Беремо найбільше число (зазвичай це Підсумок), але відкидаємо занадто гігантські (щоб не взяти номер картки)
                if (val > maxVal && val < 50000) {
                    maxVal = val;
                }
            });
            if (maxVal > 0) foundSum = maxVal;
        }

        if (foundSum) {
            amountInput.value = foundSum;
            alert(`✅ Знайдено суму: ${foundSum} грн! Перевірте правильність перед додаванням.`);
        } else {
            alert('❌ Не вдалося знайти суму на чеку. Можливо, фото розмите або формат чека нестандартний. Введіть вручну.');
            amountInput.placeholder = "Сума";
        }

        await worker.terminate();

    } catch (error) {
        console.error(error);
        alert('Помилка при скануванні. Спробуйте ще раз.');
        amountInput.placeholder = "Сума";
    } finally {
        // Повертаємо кнопку в норму
        scanBtn.innerText = "📸 Чек";
        scanBtn.disabled = false;
        // Очищаємо інпут файлу, щоб можна було зафоткати той самий чек ще раз
        event.target.value = '';
    }
}

// Робимо функцію глобальною
window.processReceipt = processReceipt;