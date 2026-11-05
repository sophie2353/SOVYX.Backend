// testStorage.js
require('dotenv').config();
const mongoose = require('mongoose');
const Audiencia = require('./src/models/Audiencia'); // Ajusta la ruta si es necesario
const campaignStorage = require('./src/routes/campaignStorageService'); // Ajusta la ruta a tu service

async function verificarStorage() {
  try {
    console.log('🔄 Conectando a MongoDB para prueba de almacenamiento...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a la base de datos.');

    console.log('\n📡 [TEST] Simulando la llamada del Radar (obtenerCampanasInactivas)...');
    
    // Llamamos exactamente a la misma función que usa tu cron
    const pendientes = await campaignStorage.obtenerCampanasInactivas();

    if (!pendientes || pendientes.length === 0) {
      console.log('⚠️ RESULTADO: No se encontraron campañas con estado "PENDIENTE".');
    } else {
      console.log(`✅ RESULTADO: ¡Éxito! Se encontraron ${pendientes.length} campaña(s) PENDIENTE(s) esperando al radar.\n`);
      
      pendientes.forEach((campana, index) => {
        console.log(`--- CAMPAÑA PENDIENTE #${index + 1} ---`);
        console.log(`👨‍💻 Cliente ID: ${campana.clientId}`);
        console.log(`🎯 Campaign ID (Meta): ${campana.campaignIdPendiente}`);
        console.log(`📦 Estado Indexación: ${campana.estadoIndexacion}`);
        console.log(`⏳ Expira en: ${campana.meta?.campaignExpiresAt}`);
        console.log(`🌐 Audiencias Inyectadas (Lookalikes):`, JSON.stringify(campana.customAudiencesPendientes, null, 2));
        console.log('-------------------------------------\n');
      });
    }

  } catch (error) {
    console.error('💥 Error durante la verificación:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Conexión cerrada.');
  }
}

verificarStorage();
