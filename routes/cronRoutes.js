const audienceStatusService = require('./audienceStatusService'); 

/* ==========================================================================
   ENDPOINT DEL RADAR (Llamado externamente cada 4 horas)
   ========================================================================== */
router.get('/api/v1/cron/radar', async (req, res) => {
  try {
    // 1. Protección estricta: Solo un servicio con la clave correcta puede disparar esto
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET || 'sodie-radar-secret-2026';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ [CRON] Intento de acceso no autorizado al Radar.');
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    console.log('⏰ [CRON EXTERNO] Disparando Radar de Audiencias...');

    // 2. Ejecutar la revisión asíncrona sin bloquear la respuesta
    // Lo disparamos y le decimos al servicio externo "Ok, recibido" de inmediato
    audienceStatusService.ejecutarChequeo().catch(err => {
      console.error('💥 Error en la ejecución en segundo plano del Radar:', err.message);
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Radar de audiencias disparado correctamente en segundo plano.' 
    });

  } catch (err) {
    console.error('💥 Error en el endpoint del cron:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

modules.exports = router;
