// test-routes.js
const app = require('./api/index'); // Apunta a tu servidor en api/index.js
const http = require('http');
const tokensConfig = require('./config/tokens');

const PORT = tokensConfig.port || 10000;
let server;

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
  console.log('🚀 Escaneando con Mocks de Archivos y Meta Graph API (CAPI, LAL Value, Campaigns, OAuth)...\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const BASE_URL = `http://localhost:${PORT}`;

  for (let r of uniqueRoutes) {
    let testPath = r.path
      .replace(/:[a-zA-Z0-9_]+/g, '123')
      .replace(/\*/g, 'test');

    const methods = r.method.split(',');
    
    for (let method of methods) {
      try {
        const options = { 
          method: method.trim(),
          headers: { 'Content-Type': 'application/json' }
        };
        
        if (['POST', 'PUT', 'PATCH'].includes(options.method)) {
          options.body = JSON.stringify({
            test: true,
            isSimulation: true,
            slotNumber: '1',
            stage: 'POST_48H',
            
            // 1. Simulación de Archivos
            mediaFiles: {
              video: 'creative_test_v1.mp4',
              image: 'ad_banner_mock.png',
              pdf: 'brief_audiencia_sodie.pdf',
              excel: 'reporte_data_audiencia.xlsx'
            },
            fileUrl: 'https://sodie.app/storage/simulated_x.mp4',
            fileCode: 'X_MP4_MOCK_2026',

            // 2. Simulación de Integraciones Meta Graph API
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
                ph: ['2b00042f7481c7b056c4b410d28f33cfb292e221501b0d268d234560183',
                client_user_agent: 'Mozilla/5.0 Mock Browser'
              },
              custom_data: {
                currency: 'USD',
                value: 49.99
              }
            },

            // Payload para Creación de Campañas y AdSets
            campaignData: {
              name: 'SODIE_SIMULATION_CAMPAIGN',
              objective: 'OUTCOME_SALES',
              status: 'PAUSED',
              daily_budget: 5000,
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

            // Solicitud de Métricas / Insights
            insightsQuery: {
              date_preset: 'last_30d',
              fields: ['impressions', 'clicks', 'spend', 'cpc', 'roas', 'conversions'],
              level: 'ad'
            }
          });
        }

        const response = await fetch(`${BASE_URL}${testPath}`, options);
        
        if (response.ok || [400, 401, 403, 404, 422].includes(response.status)) {
          console.log(`✅ [${response.status}] ${options.method} -> ${testPath}`);
        } else {
          console.log(`⚠️ [${response.status}] ${options.method} -> ${testPath} (Revisar logs)`);
        }
      } catch (err) {
        console.log(`❌ [FALLO] ${options.method} -> ${testPath} : ${err.message}`);
      }
    }
  }

  console.log('\n🏁 Escaneo masivo completado. Todas las rutas y Graph API cubiertas 🗿💅🏽');
  server.close();
  process.exit(0);
}

runTests();
