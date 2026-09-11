// test-routes.js
const app = require('./index'); // Apunta a tu servidor de express (index.js)
const http = require('http');
const tokensConfig = require('./config/tokens');

const PORT = tokensConfig.port || 10000;
let server;

// Extractor recursivo de rutas del árbol de Express
function getRoutes(stack, prefix = '', routes = []) {
  stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      routes.push({ method: methods, path: prefix + layer.route.path });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
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
  console.log('🔍 Extrayendo el árbol completo de rutas de SODIE OS v2.0.28...');
  
  let rawRoutes = [];
  try {
    rawRoutes = getRoutes(app._router.stack);
  } catch (err) {
    console.error('❌ Error accediendo al router de Express. Verifica la exportación en index.js:', err.message);
    process.exit(1);
  }

  const uniqueRoutes = Array.from(new Set(rawRoutes.map(JSON.stringify))).map(JSON.parse);
  
  console.log(`✨ Se detectaron ${uniqueRoutes.length} endpoints en total.`);
  console.log('🚀 Iniciando Simulación de Alto Nivel: Meta Graph API (CAPI, LAL Value), Pasarelas, Evaluador, SSE, Media & Waitlist V4...\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const BASE_URL = `http://localhost:${PORT}`;

  let pasados = 0;
  let conAdvertencia = 0;
  let fallados = 0;

  for (let r of uniqueRoutes) {
    // Reemplazo inteligente de rutas dinámicas
    let testPath = r.path
      .replace(/:userId/g, 'usr_tester_2026')
      .replace(/:slotId/g, 'slot_1')
      .replace(/:campaignId/g, 'cmp_meta_9988')
      .replace(/:[a-zA-Z0-9_]+/g, '123')
      .replace(/\*/g, 'test');

    const methods = r.method.split(',');
    
    for (let method of methods) {
      try {
        const options = { 
          method: method.trim(),
          headers: { 
            'Content-Type': 'application/json',
            'x-sovyx-admin-key': tokensConfig.SOVYX_ADMIN_KEY || 'admin23555'
          }
        };
        
        if (['POST', 'PUT', 'PATCH'].includes(options.method)) {
          options.body = JSON.stringify({
            test: true,
            isSimulation: true,
            slotNumber: '1',
            stage: 'POST_48H',
            
            // 1. Simulación de Registro & Usuarios
            nombre: 'Cliente Exclusivo Tester',
            email: 'cliente.vip@sodie.app',
            compania: 'Marca Ecommerce Elite',
            timerHours: 72,

            // 2. Simulación de Pasarelas de Pago (Kontigo $1K & Binance Pay $9K)
            paymentSimulation: {
              gateway: 'KONTIGO_PAY',
              amountUSD: 1000,
              txHash: '0xabc123789def4569087654321fedcba',
              status: 'APPROVED',
              slotReservation: 1,
              timeLimitHours: 48
            },

            // 3. Simulación de Evaluación, Contratos & Biometría
            evaluator: {
              contratoId: 'CT-SODIE-2026-V4',
              documentType: 'PDF_AGREEMENT',
              documentUrl: 'https://sodie.app/uploads/contrato_firmado.pdf',
              biometricHash: 'bio_fingerprint_hash_987654321',
              status: 'PENDING_ADMIN_REVIEW'
            },
            
            // 4. Simulación de Archivos y Medios
            mediaFiles: {
              video: 'creative_test_v1.mp4',
              image: 'ad_banner_mock.png',
              pdf: 'brief_audiencia_sodie.pdf',
              excel: 'reporte_data_audiencia.xlsx',
              csv: 'audiencia_clientes_hora48.csv'
            },
            fileUrl: 'https://sodie.app/uploads/simulated_creative.mp4',
            fileCode: 'X_MP4_MOCK_2026',

            // 5. Simulación de Integraciones Meta Graph API
            metaAuth: {
              accessToken: tokensConfig.meta?.accessToken || 'EAAB_MOCK_TOKEN_SODIE_2026',
              accountId: tokensConfig.meta?.accountId || 'act_123456789012345',
              pixelId: tokensConfig.meta?.pixelId || '1122334455667788',
              businessId: 'biz_9988776655'
            },

            // Payload para Conversions API (CAPI)
            capiEvent: {
              event_name: 'Purchase',
              event_time: Math.floor(Date.now() / 1000),
              event_source_url: 'https://sodie.app/checkout',
              user_data: {
                em: ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
                ph: ['2b00042f7481c7b056c4b410d28f33cfb292e221501b0d268d234560183'],
                client_user_agent: 'Mozilla/5.0 Mock Browser'
              },
              custom_data: {
                currency: 'USD',
                value: 1000.00
              }
            },

            // Payload para Creación de Campañas y AdSets
            campaignData: {
              name: 'SODIE_SIMULATION_CAMPAIGN_V4',
              objective: 'OUTCOME_SALES',
              status: 'PAUSED',
              daily_budget: 10000,
              bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
            },

            // Payload para Segmentación Lookalike con Value (LAL V)
            lookalikeSpec: {
              origin_audience_id: 'aud_custom_value_999',
              ratio: 0.01, // 1%
              country: 'US',
              is_value_based: true,
              value_schema: 'CUSTOMER_LIFETIME_VALUE'
            },

            // Solicitud de Métricas / Insights / SSE
            insightsQuery: {
              date_preset: 'last_30d',
              fields: ['impressions', 'clicks', 'spend', 'cpc', 'roas', 'conversions'],
              level: 'ad'
            },

            // Chat / Mensajería IA2
            message: 'Simulación de prueba: Información sobre activación de slots de $10K USD'
          });
        }

        const response = await fetch(`${BASE_URL}${testPath}`, options);
        
        // Aceptamos respuestas exitosas (2xx) y respuestas de validación esperadas (4xx)
        if (response.ok || [400, 401, 403, 404, 422].includes(response.status)) {
          console.log(`✅ [${response.status}] ${options.method} -> ${testPath}`);
          pasados++;
        } else {
          console.log(`⚠️ [${response.status}] ${options.method} -> ${testPath} (Respuesta de error 5xx)`);
          conAdvertencia++;
        }
      } catch (err) {
        console.log(`❌ [FALLO CONEXIÓN] ${options.method} -> ${testPath} : ${err.message}`);
        fallados++;
      }
    }
  }

  console.log('\n===========================================');
  console.log('📊 RESUMEN DE LA AUDITORÍA DE RUTAS:');
  console.log(`🟢 Endpoints Verificados: ${pasados}`);
  if (conAdvertencia > 0) console.log(`⚠️ Respuestas 5xx: ${conAdvertencia}`);
  if (fallados > 0) console.log(`🔴 Fallos de Red/Conexión: ${fallados}`);
  console.log('===========================================\n');

  if (fallados === 0 && conAdvertencia === 0) {
    console.log('🏁 ¡Escaneo masivo completado! Todas las rutas, Meta Graph API y Pasarelas listas para grabar pantalla. 🗿💅🏽\n');
  } else {
    console.log('⚠️ Revisa los endpoints señalados arriba antes de la grabación.\n');
  }

  server.close();
  process.exit(0);
}

runTests();
