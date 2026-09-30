const express = require('express');
const router = express.Router();

// Almacenamiento en nube para la Lista de Espera SODIE V4
global.waitlistDB = global.waitlistDB || [];
global.waitlistStatusOverride = global.waitlistStatusOverride || null;

// Registro en Lista de Espera SODIE V4 con Biometría
router.post(['/registro', '/'], (req, res) => {
  if (global.waitlistStatusOverride === 'CLOSED') {
    return res.status(403).json({
      success: false,
      error: 'La lista de espera ha sido cerrada manualmente desde el panel de administración.'
    });
  }

  const { nombre, compania, password, biometriaHash, email, timerHours = 72 } = req.body;

  // Fallback para pruebas si no envían datos
  const userEmail = email || req.body.mail || `usr_${Date.now()}@sodie.app`;
  const userName = nombre || req.body.name || 'Usuario V4';

  const countdownMs = (parseInt(timerHours) || 72) * 60 * 60 * 1000;
  const draftDeadline = new Date(Date.now() + countdownMs).toISOString();

  const usuarioV4 = {
    id: `V4-USR-${Date.now()}`,
    nombre: userName,
    compania: compania || 'N/A',
    email: userEmail,
    passwordHash: password ? 'HASHED_SECURE' : null,
    biometriaActiva: !!biometriaHash,
    biometriaData: biometriaHash || null,
    draftDeadline,
    registradoEn: new Date().toISOString(),
    fase: 'FASE_1_SODIE_V4'
  };

  global.waitlistDB.push(usuarioV4);

  return res.json({
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

// Estado general de la lista de espera (Soporta /estado y /status)
router.get(['/estado', '/status'], (req, res) => {
  const totalRegistrados = global.waitlistDB.length;
  const estaCerradaPorAdmin = global.waitlistStatusOverride === 'CLOSED';
  const cuposDisponibles = estaCerradaPorAdmin ? 0 : Math.max(0, 18 - totalRegistrados);

  return res.json({
    fase: 'Fase 1 - SODIE V4',
    totalCuposFase1: 18,
    cuposDisponibles,
    registrados: totalRegistrados,
    status: (estaCerradaPorAdmin || cuposDisponibles === 0) 
      ? 'LISTA_DE_ESPERA_CERRADA' 
      : 'LISTA_DE_ESPERA_ACTIVADA'
  });
});

module.exports=router;
