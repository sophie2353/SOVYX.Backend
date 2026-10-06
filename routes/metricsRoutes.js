const express = require('express');
const router = express.Router();

// Almacena los clientes SSE conectados para transmitir en tiempo real
let sseClients = [];

/**
 * GET /api/v1/metrics/sse
 * Canal Server-Sent Events para métricas e interfaz en vivo
 */
router.get('/v1/metrics/sse', (req, res) => {
  // Headers obligatorios para mantener la conexión SSE abierta
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Enviar un ping inicial o estado actual al conectar
  const initialPayload = JSON.stringify({
    type: 'CONNECTED',
    disponibles: 3, // O consulta actual a la BD
    timestamp: Date.now()
  });
  res.write(`data: ${initialPayload}\n\n`);

  // Guardar la respuesta para transmisiones futuras
  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Limpiar la conexión cuando el cliente se desconecta o cierra la pestaña
  req.on('close', () => {
    sseClients = sseClients.filter((client) => client.id !== clientId);
  });
});

/**
 * Función auxiliar para transmitir actualizaciones a TODOS los clientes
 * Puedes invocarla desde cualquier parte de tu backend cuando cambien los cupos o métricas
 */
function broadcastMetricUpdate(data) {
  const payload = JSON.stringify(data);
  sseClients.forEach((client) => {
    client.res.write(`data: ${payload}\n\n`);
  });
}

// Ejemplo de uso: invocar broadcastMetricUpdate({ disponibles: 2, timestamp: Date.now() });

module.exports = {
  router,
  broadcastMetricUpdate
};
