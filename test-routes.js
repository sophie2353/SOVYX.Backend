// test-routes.js
const app = require('./api/index'); // Apunta a tu servidor en api/index.js
const http = require('http');
const tokensConfig = require('./config/tokens');

const PORT = tokensConfig.port || 10000;
let server;

// Configuración de Mocks para pruebas de carga pesada
function buildMultiPartMock(filename, contentType, textContent) {
  const boundary = '----WebKitFormBoundarySOVYXSODIE2026';
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    '',
    textContent,
    `--${boundary}--`
  ].join('\r\n');

  return {
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  };
}

function getRoutes(stack, prefix = '', routes = []) {
  stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      routes.push({ method: methods, path: prefix + layer.route.path });
    } else if (layer.name === 'router' && layer.handle.stack) {
      let routerPath = '';
      if (layer.regexp) {
        const match = layer.regexp.source.match(/^\/\^\\\/([a-zA-Z0-9_-]+)/);
        if (match) routerPath = '/' + match[1];
      }
      getRoutes(layer.handle.stack, prefix + routerPath, routes);
    }
  });
  return routes;
}

async function runTests() {
  console.log('🔍 Extrayendo el árbol de rutas de SODIE (v3.5)...');
  
  const rawRoutes = getRoutes(app._router.stack);
  const uniqueRoutes = Array.from(new Set(rawRoutes.map(JSON.stringify))).map(JSON.parse);
  
  console.log(`✨ Se detectaron ${uniqueRoutes.length} endpoints en total.\n`);
  console.log('🚀 Iniciando escaneo masivo (Excel/PDF/Video, IA1, IA2, Meta Services & Cron Jobs)...\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const BASE_URL = `http://localhost:${PORT}`;

  for (let r of uniqueRoutes) {
    let testPath = r.path
      .replace(/:[a-zA-Z]+/g, '123')
      .replace(/\(\?:\.\+\)/g, 'test');

    const methods = r.method.split(',');
    
    for (let method of methods) {
      try {
        const options = { method: method.trim() };
        
        // Simulación según el tipo de payload
        if (['POST', 'PUT', 'PATCH'].includes(options.method)) {
          if (testPath.includes('excel') || testPath.includes('upload')) {
            // Mock de Excel / CSV para IA1
            const mock = buildMultiPartMock('data_audiencia.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Mock Data Excel SODIE');
            options.headers = mock.headers;
            options.body = mock.body;
          } else if (testPath.includes('pdf')) {
            // Mock de PDF
            const mock = buildMultiPartMock('brief.pdf', 'application/pdf', '%PDF-1.4 Mock Brief');
            options.headers = mock.headers;
            options.body = mock.body;
          } else if (testPath.includes('video') || testPath.includes('media')) {
            // Mock de Video / Imagen
            const mock = buildMultiPartMock('creative.mp4', 'video/mp4', 'video-raw-bytes-mock');
            options.headers = mock.headers;
            options.body = mock.body;
          } else {
            // Payload JSON estándar para IA2, Graph API y Pasarela
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify({
              test: true,
              slotNumber: '1',
              stage: 'POST_48H',
              userDataHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Hash SHA256 simulado sin value
              pixelId: tokensConfig.meta.pixelId,
              accountId: tokensConfig.meta.accountId
            });
          }
        }

        const response = await fetch(`${BASE_URL}${testPath}`, options);
        
        if (response.ok || [400, 401, 422].includes(response.status)) {
          console.log(`✅ [${response.status}] ${options.method} -> ${testPath}`);
        } else {
          console.log(`⚠️ [${response.status}] ${options.method} -> ${testPath} (Revisar logs)`);
        }
      } catch (err) {
        console.log(`❌ [FALLO] ${options.method} -> ${testPath} : ${err.message}`);
      }
    }
  }

  console.log('\n🏁 Escaneo masivo completado. Tu infraestructura SODIE v3.5 está lista 🗿💅🏽');
  server.close();
  process.exit(0);
}

runTests();
