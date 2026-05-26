const fileInput = document.getElementById('fileInput');
const selectBtn = document.getElementById('selectBtn');
const enhanceBtn = document.getElementById('enhanceBtn');
const saveBtn = document.getElementById('saveBtn');
const canvas = document.getElementById('preview');
const originalImg = document.getElementById('originalImg');
const status = document.getElementById('status');

let originalImageData = null;
let enhancedDataUrl = null;

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
}

// Открыть выбор файла
selectBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', loadImage);

function loadImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        originalImg.src = ev.target.result;
        originalImg.classList.remove('hidden');
        canvas.classList.add('hidden');
        enhanceBtn.classList.remove('hidden');
        saveBtn.classList.add('hidden');
        status.textContent = '';
    };
    reader.readAsDataURL(file);
}

// Основное улучшение
enhanceBtn.addEventListener('click', () => {
    if (!originalImg.src) return;
    status.textContent = 'Обработка...';
    enhanceBtn.disabled = true;
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        // Подгоняем размер холста под изображение
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Получаем пиксели
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // === Алгоритмы улучшения ===
        applyAutoLevels(data);       // автотон
        applyUnsharpMask(data, canvas.width, canvas.height); // резкость
        reduceNoise(data, canvas.width, canvas.height);       // лёгкое шумоподавление
        
        ctx.putImageData(imageData, 0, 0);
        enhancedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        // Показываем холст вместо исходной картинки
        originalImg.classList.add('hidden');
        canvas.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
        enhanceBtn.disabled = false;
        status.textContent = 'Готово! Можно сохранить.';
    };
    img.src = originalImg.src;
});

// Сохранение результата
saveBtn.addEventListener('click', () => {
    if (!enhancedDataUrl) return;
    const link = document.createElement('a');
    link.download = 'enhanced_photo.jpg';
    link.href = enhancedDataUrl;
    link.click();
    status.textContent = 'Сохранено в галерею';
});

// === Умные фильтры ===

function applyAutoLevels(pixels) {
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (g < minG) minG = g;
        if (g > maxG) maxG = g;
        if (b < minB) minB = b;
        if (b > maxB) maxB = b;
    }
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i]   = ((pixels[i]   - minR) / (maxR - minR || 1)) * 255;
        pixels[i+1] = ((pixels[i+1] - minG) / (maxG - minG || 1)) * 255;
        pixels[i+2] = ((pixels[i+2] - minB) / (maxB - minB || 1)) * 255;
    }
}

function applyUnsharpMask(pixels, width, height) {
    const copy = new Uint8ClampedArray(pixels);
    const amount = 0.6; // сила эффекта
    const radius = 2;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const idx = (ny * width + nx) * 4;
                        r += copy[idx];
                        g += copy[idx+1];
                        b += copy[idx+2];
                        count++;
                    }
                }
            }
            const idx = (y * width + x) * 4;
            const blurR = r / count, blurG = g / count, blurB = b / count;
            pixels[idx]   = Math.min(255, Math.max(0, copy[idx]   + amount * (copy[idx]   - blurR)));
            pixels[idx+1] = Math.min(255, Math.max(0, copy[idx+1] + amount * (copy[idx+1] - blurG)));
            pixels[idx+2] = Math.min(255, Math.max(0, copy[idx+2] + amount * (copy[idx+2] - blurB)));
        }
    }
}

function reduceNoise(pixels, width, height) {
    const copy = new Uint8ClampedArray(pixels);
    for (let y = 1; y < height-1; y++) {
        for (let x = 1; x < width-1; x++) {
            const idx = (y * width + x) * 4;
            for (let c = 0; c < 3; c++) {
                const val = copy[idx+c];
                const neighbors = [
                    copy[((y-1)*width + x)*4 + c],
                    copy[((y+1)*width + x)*4 + c],
                    copy[(y*width + (x-1))*4 + c],
                    copy[(y*width + (x+1))*4 + c]
                ];
                const avg = neighbors.reduce((a,b)=>a+b)/4;
                if (Math.abs(val - avg) > 30) {
                    pixels[idx+c] = avg; // замена на среднее, если сильно выбивается
                }
            }
        }
    }
}
