const express = require('express');
const router = express.Router();

// Almacenamiento global para SODIE V4
global.waitlistDB = global.waitlistDB || [];
global.waitlistStatusOverride = global.waitlistStatusOverride || null;

// Límite total de cupos para la Waitlist
const TOTAL_CUPOS_WAITLIST = 50;

// Registro en Lista de Espera SODIE V4 con Biometría
router.post(['/registro', '/'], (req, res) => {
  if (global.waitlistStatusOverride === 'CLOSED') {
    return res.status(403).json({
      success: false,
      error: 'La lista de espera ha sido cerrada manualmente desde el panel de administración.'
    });
  }

  const totalPagadosOCONFIRMADAS = global.waitlistDB.filter(u => u.confirmado).length;
  const cuposDisponibles = Math.max(0, TOTAL_CUPOS_WAITLIST - totalPagadosOCONFIRMADAS);

  if (cuposDisponibles === 0) {
    return res.status(400).json({
      success: false,
      error: 'La lista de espera ha alcanzado el límite máximo de 50 cupos.'
    });
  }

  const { nombre, compania, password, biometriaHash, email, timerHours = 72 } = req.body;

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
    confirmado: false, // Se confirma al pagar
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
    cuposRestantesFase1: cuposDisponibles
  });
});

// NUEVO ENDPOINT: Confirmación de Pago desde la Waitlist
router.post('/confirm-waitlist', async (req, res) => {
  try {
    const { email, userId } = req.body;

    // Buscar el usuario en la lista de espera
    let usuario = global.waitlistDB.find(u => 
      (userId && u.id === userId) || (email && u.email === email)
    );

    if (!usuario) {
      // Si no existe previo, se crea un registro al vuelo para no bloquear el pago
      usuario = {
        id: userId || `V4-USR-${Date.now()}`,
        email: email || `cliente_${Date.now()}@sodie.app`,
        confirmado: false
      };
      global.waitlistDB.push(usuario);
    }

    // Marcar como confirmado (resta 1 a los cupos disponibles)
    if (!usuario.confirmado) {
      usuario.confirmado = true;
      usuario.fechaConfirmacion = new Date().toISOString();
    }

    // Calcular cupos restantes de 50
    const totalConfirmados = global.waitlistDB.filter(u => u.confirmado).length;
    const cuposRestantes = Math.max(0, TOTAL_CUPOS_WAITLIST - totalConfirmados);

    // Generar automáticamente el Client ID secuencial V4
    const clientIDRoutes = require('./clientIDRoutes');
    const newClientID = clientIDRoutes.generateNextV4ClientId();

    return res.status(200).json({
      success: true,
      message: 'Pago confirmado correctamente en la Waitlist.',
      clientId: newClientID,
      waitlistStatus: {
        cuposTotales: TOTAL_CUPOS_WAITLIST,
        confirmados: totalConfirmados,
        cuposRestantes: cuposRestantes
      }
    });

  } catch (error) {
    console.error('Error en confirm-waitlist:', error);
    return res.status(500).json({ success: false, error: 'Error procesando confirmación de waitlist.' });
  }
});

// Estado general de la lista de espera
router.get(['/estado', '/status'], (req, res) => {
  const totalConfirmados = global.waitlistDB.filter(u => u.confirmado).length;
  const estaCerradaPorAdmin = global.waitlistStatusOverride === 'CLOSED';
  const cuposDisponibles = estaCerradaPorAdmin ? 0 : Math.max(0, TOTAL_CUPOS_WAITLIST - totalConfirmados);

  return res.json({
    fase: 'Fase Final - SODIE V4',
    totalCuposFase1: TOTAL_CUPOS_WAITLIST,
    cuposDisponibles,
    registrados: global.waitlistDB.length,
    confirmados: totalConfirmados,
    status: (estaCerradaPorAdmin || cuposDisponibles === 0) 
      ? 'LISTA_DE_ESPERA_CERRADA' 
      : 'LISTA_DE_ESPERA_ACTIVADA'
  });
});

module.exports = router;
