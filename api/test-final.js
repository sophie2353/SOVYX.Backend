require('dotenv').config();
const mongoose = require('mongoose');

// Ajusta estas rutas a donde tengas tus servicios realmente
const campaignStorage = require('../routes/campaignStorageService'); 
const audienceStatusService = require('../routes/audienceStatusService'); 

async function probarOrquestacionCompleta() {
  try {
    console.log('🔄 Conectando a MongoDB para prueba integral...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a la base de datos.\n');

    console.log('======================================================');
    console.log('🚀 FASE 1: VERIFICACIÓN DE STORAGE (¿Se guardó en DB?)');
    console.log('======================================================');
    
    const pendientes = await campaignStorage.obtenerCampanasInactivas();

    if (!pendientes || pendientes.length === 0) {
      console.log('⚠️ RESULTADO: No hay campañas en estado "PENDIENTE".');
      console.log('💡 Nota: Lanza un borrador nuevo desde tu dashboard y vuelve a correr este test.');
    } else {
      console.log(`✅ RESULTADO: Se encontraron ${pendientes.length} campaña(s) esperando al radar.`);
      pendientes.forEach((campana, index) => {
        console.log(`  -> [${index + 1}] Cliente: ${campana.clientId} | Campaña Meta ID: ${campana.campaignIdPendiente}`);
        console.log(`  -> Audiencias LAL inyectadas: ${campana.customAudiencesPendientes.length}`);
      });

      console.log('\n======================================================');
      console.log('⏰ FASE 2: SIMULACIÓN DE RADAR (Salto de 4 horas)');
      console.log('======================================================');
      
      // Forzamos el chequeo exacto que haría el cron-job
      await audienceStatusService.ejecutarChequeo();

      console.log('\n✨ [TEST INTEGRAL COMPLETADO] Verifica en los logs de arriba si se disparó la Push y si pasó a LISTO.');
    }

  } catch (error) {
    console.error('💥 Error crítico durante la prueba integral:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Conexión cerrada.');
  }
}

probarOrquestacionCompleta();
