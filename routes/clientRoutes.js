const express = require('express');
const router = express.Router();

// Base de datos en memoria (Sustituir con tu DB persistente)
const CLIENT_DB = {
  'CLIENT-0': { password: 'admin2026', name: 'Cliente Maestro / Admin Demo', isRegistered: true }
};

/**
 * @route   POST /api/client/register
 * @desc    Registro inicial del cliente (Establece su contraseña por primera vez)
 */
router.post('/register', (req, res) => {
  try {
    const { clientId, password } = req.body;

    if (!clientId || !password) {
      return res.status(400).json({
        success: false,
        message: 'ID de cliente y contraseña son requeridos.'
      });
    }

    const cleanClientId = clientId.trim().toUpperCase();
    const cleanPassword = password.trim();

    // Si ya existe y está registrado con contraseña
    if (CLIENT_DB[cleanClientId] && CLIENT_DB[cleanClientId].isRegistered) {
      return res.status(400).json({
        success: false,
        message: 'Este ID de cliente ya fue registrado. Utiliza la opción de Iniciar Sesión.'
      });
    }

    // Registrar o actualizar contraseña inicial
    CLIENT_DB[cleanClientId] = {
      password: cleanPassword,
      name: `Cliente ${cleanClientId}`,
      isRegistered: true,
      registeredAt: new Date()
    };

    console.log(`[CLIENTE] Registro completado para: ${cleanClientId}`);

    return res.status(200).json({
      success: true,
      message: 'Registro exitoso. ¡Bienvenido a tu dashboard!',
      clientId: cleanClientId
    });

  } catch (error) {
    console.error('Error en /api/client/register:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el registro.'
    });
  }
});

/**
 * @route   POST /api/client/login
 * @desc    Inicio de sesión para accesos posteriores (o entrada de CLIENT-0)
 */
router.post('/login', (req, res) => {
  try {
    const { clientId, password } = req.body;

    if (!clientId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Ingresa tu ID de cliente y contraseña.'
      });
    }

    const cleanClientId = clientId.trim().toUpperCase();
    const cleanPassword = password.trim();

    const client = CLIENT_DB[cleanClientId];

    // Validación de credenciales
    if (client && client.password === cleanPassword) {
      return res.status(200).json({
        success: true,
        message: 'Autenticación exitosa',
        clientId: cleanClientId,
        token: `sodie_token_${cleanClientId}_${Date.now()}`
      });
    }

    return res.status(401).json({
      success: false,
      message: 'ID de cliente o contraseña incorrectos.'
    });

  } catch (error) {
    console.error('Error en /api/client/login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en el servidor.'
    });
  }
});

module.exports = router;
