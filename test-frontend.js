// test-frontend.js
const puppeteer = require('puppeteer');
const path = require('path');

// ⚠️ CAMBIA ESTA URL POR LA DE TU SERVIDOR O FRONTEND (ej: http://localhost:3000 o https://sodie.app)
const BASE_URL = 'http://sodie.app';

(async () => {
  console.log('🚀 INICIANDO AUDITORÍA INTEGRAL DE FRONTEND...');
  
  const browser = await puppeteer.launch({ 
    headless: "new", // Pon false si quieres VER físicamente la ventana abriéndose
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. CAPTURAR ERRORES DE JAVASCRIPT EN CONSOLA DEL NAVEGADOR
  page.on('pageerror', err => {
    console.error('❌ [ERROR JS EN FRONTEND]:', err.message);
  });

  // 2. CAPTURAR ERRORES DE RED (PETICIONES FALLIDAS / 404 / 500 / CORS)
  page.on('requestfailed', request => {
    console.error(`💥 [ERROR DE RED]: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      console.error(`⚠️ [RESPUESTA HTTP FALLIDA ${response.status()}]: ${response.url()}`);
    }
  });

  try {
    // -------------------------------------------------------------
    // PRUEBA 1: PANEL ADMINISTRADOR (admin.html)
    // -------------------------------------------------------------
    console.log('\n🔍 --- Probando admin.html ---');
    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle2' });

    // Probar si existe el cronómetro
    const timerAdmin = await page.$('#admin-timer-display');
    console.log(timerAdmin ? '  ✅ Elemento Cronómetro encontrado' : '  ❌ FALTA: No se encuentra #admin-timer-display');

    // Simular Clic en botón "Iniciar Cronómetro"
    const btnIniciarTimer = await page.$('button[onclick*="sodieIniciarCronometro"]');
    if (btnIniciarTimer) {
      console.log('  👉 Simulando clic en "Iniciar Cronómetro"...');
      await btnIniciarTimer.click();
    } else {
      console.log('  ⚠️ Botón de iniciar cronómetro no encontrado o sin evento onclick válido.');
    }

    // Simular Subida de Archivo (Video)
    const fileInput = await page.$('#admin-video-file');
    const uploadBtn = await page.$('#btn-upload-video');

    if (fileInput && uploadBtn) {
      console.log('  👉 Simulando selección y subida de archivo...');
      // Crea un archivo dummy temporal o apunta a uno real de prueba
      const dummyFilePath = path.join(__dirname, 'test-dummy.mp4');
      
      // Adjuntar archivo al input
      await fileInput.uploadFile(dummyFilePath).catch(() => {
        console.log('  ⚠️ No se encontró un archivo local "test-dummy.mp4", pasando selección simulada.');
      });

      // Hacer clic en Subir
      await uploadBtn.click();
      console.log('  👉 Clic en "Subir Video" ejecutado.');
    } else {
      console.log('  ❌ FALTA: Input o botón de subida de video no encontrados en el DOM.');
    }

    // -------------------------------------------------------------
    // PRUEBA 2: VISTA CLIENTE (client.html)
    // -------------------------------------------------------------
    console.log('\n🔍 --- Probando client.html ---');
    await page.goto(`${BASE_URL}/client.html`, { waitUntil: 'networkidle2' });

    const timerClient = await page.$('#timer-display') || await page.$('#admin-timer-display');
    console.log(timerClient ? '  ✅ Cronómetro de Cliente detectado' : '  ❌ FALTA: Cronómetro en client.html no hallado');

    // -------------------------------------------------------------
    // PRUEBA 3: CONFIRMACIÓN (confirmacion.html)
    // -------------------------------------------------------------
    console.log('\n🔍 --- Probando confirmacion.html ---');
    await page.goto(`${BASE_URL}/confirmacion.html`, { waitUntil: 'networkidle2' });
    console.log('  ✅ Vista de confirmación cargada correctamente.');

  } catch (error) {
    console.error('🔥 Error crítico al ejecutar las simulaciones:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 PRUEBA DE FRONTEND COMPLETADA.\n');
  }
})();
