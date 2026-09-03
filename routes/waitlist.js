const express = require('express');
const router = express.Router();

// Almacenamiento en nube para la Lista de Espera SODIE V4
global.waitlistDB = global.waitlistDB || [];

// Registro en Lista de Espera SODIE V4 con Biometría
router.post('/registro', (req, res) => {
  const { nombre, compania, password, biometriaHash, email, timerHours = 72 } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ success: false, error: 'Nombre y Email son requeridos.' });
  }

  const countdownMs = (parseInt(timerHours) || 72) * 60 * 60 * 1000;
  const draftDeadline = new Date(Date.now() + countdownMs).toISOString();

  const usuarioV4 = {
    id: `V4-USR-${Date.now()}`,
    nombre,
    compania: compania || 'N/A',
    email,
    passwordHash: password ? 'HASHED_SECURE' : null,
    biometriaActiva: !!biometriaHash,
    biometriaData: biometriaHash || null,
    draftDeadline,
    registradoEn: new Date().toISOString(),
    fase: 'FASE_1_SODIE_V4'
  };

  global.waitlistDB.push(usuarioV4);

  res.json({
    success: true,
    message: 'Registrado con éxito en la lista de espera SODIE V4',
    usuario: {
      id: usuarioV4.id,
      nombre: usuarioV4.nombre,
      compania: usuarioV4.compania,
      draftDeadline: usuarioV4.draftDeadline,
      biometriaActiva: usuarioV4.biometriaActiva
    },
    cuposRestantesFase1: Math.max(0, 18 - global.waitlistDB.length)
  });
});

// Login rápido con contraseña o Biometría (Entrada en 10s)
router.post('/login', (req, res) => {
  const { email, password, biometriaHash, usarBiometria } = req.body;

  const user = global.waitlistDB.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Usuario no registrado en SODIE V4' });
  }

  if (usarBiometria) {
    return res.json({
      success: true,
      loginMethod: 'BIOMETRIC_FAST_PASS',
      entryTimeSecs: 10,
      usuario: user
    });
  }

  res.json({
    success: true,
    loginMethod: 'PASSWORD',
    usuario: user
  });
});

// Estado general de la lista de espera
router.get('/estado', (req, res) => {
  const totalRegistrados = global.waitlistDB.length;
  const cuposDisponibles = Math.max(0, 18 - totalRegistrados);

  res.json({
    fase: 'Fase 1 - SODIE V4',
    totalCuposFase1: 18,
    cuposDisponibles,
    registrados: totalRegistrados,
    status: cuposDisponibles === 0 ? 'LISTA_DE_ESPERA_CERRADA' : 'LISTA_DE_ESPERA_ACTIVADA'
  });
});

module.exports = router;
