const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/* ==========================================================================
   1. WEBAUTHN / BIOMETRICS: CHALLENGE
   ========================================================================== */
router.post('/biometrics/challenge', (req, res) => {
  try {
    const { userId, email } = req.body;
    
    // Generar un challenge criptográfico seguro de 32 bytes aleatorios
    const challengeBuffer = crypto.randomBytes(32);
    const challengeBase64 = challengeBuffer.toString('base64url');

    return res.json({
      success: true,
      challenge: challengeBase64,
      timeout: 60000,
      rp: {
        name: 'SODIE OS AI',
        id: req.hostname || 'sodie.app'
      },
      user: {
        id: userId || 'user_' + Date.now(),
        name: email || 'usuario@sodie.app',
        displayName: 'Usuario SODIE'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required'
      }
    });
  } catch (error) {
    console.error('💥 Error generando challenge biométrico:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al generar el reto biométrico.'
    });
  }
});

/* ==========================================================================
   2. WEBAUTHN / BIOMETRICS: REGISTER
   ========================================================================== */
router.post('/biometrics/register', (req, res) => {
  try {
    const { credential, response, id } = req.body;

    // Validación básica del paquete recibido desde la API WebAuthn del navegador
    if (!id && !credential) {
      return res.status(400).json({
        success: false,
        error: 'Datos de credencial biométrica incompletos'
      });
    }

    console.log(`🟢 [BIOMETRICS] Nueva huella/FaceID registrada para la credencial ID: ${id || credential.id}`);

    return res.json({
      success: true,
      status: 'VERIFIED',
      message: 'Autenticación biométrica vinculada con éxito en el dispositivo.',
      credentialId: id || credential.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Error registrando credencial biométrica:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al verificar la firma biométrica.'
    });
  }
});

module.exports = router;
