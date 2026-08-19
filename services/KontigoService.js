const axios = require('axios');
const config = require('../config/tokens');

/**
 * Genera una orden de pago dinámica vinculada al email y webhook.
 */
async function generarCheckoutKontigo({ email, clienteId }) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:10000';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const response = await axios.post(
      'https://api.kontigo.com/v1/payment-links', // Endpoint oficial de la API de Kontigo
      {
        amount: 1000,
        currency: 'USD',
        title: 'Reserva Slot SOVYX OS (48H)',
        description: 'Acceso inicial a infraestructura publicitaria SOVYX',
        customer_email: email,
        metadata: { clienteId },
        webhook_url: `${backendUrl}/api/webhooks/kontigo`,
        redirect_url: `${frontendUrl}/pago-exitoso`
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.KONTIGO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.payment_url || response.data.url;
  } catch (error) {
    console.error('🔴 Error Kontigo API:', error.response?.data || error.message);
    throw new Error('No se pudo generar la pasarela de pago');
  }
}

module.exports = { generarCheckoutKontigo };
