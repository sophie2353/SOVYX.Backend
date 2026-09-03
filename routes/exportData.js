const express = require('express');
const router = express.Router();
const tokens = require('../config/tokens');

// Generar y exportar el CSV de Clientes Hora 48
router.get('/export-clientes-hora48', (req, res) => {
  const { adminKey } = req.query;

  if (adminKey !== tokens.SOVYX_ADMIN_KEY) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }

  // Clientes simulados / recuperados de la DB que casi o totalmente llenaron el formulario
  const clientesHora48 = global.clientesHora48DB || [
    { id: 1, nombre: 'Cliente Evaluador 1', email: 'evaluador1@empresa.com', telefono: '+123456789', estado: 'FORMULARIO_INCOMPLETO_90%', hora: '24h' },
    { id: 2, nombre: 'Cliente Evaluador 2', email: 'evaluador2@empresa.com', telefono: '+987654321', estado: 'ESPERANDO_PASARELA', hora: '48h' }
  ];

  // Formatear a CSV
  let csvContent = 'ID,Nombre,Email,Telefono,EstadoFormulario,HoraEvaluador\n';
  clientesHora48.forEach(c => {
    csvContent += `"${c.id}","${c.nombre}","${c.email}","${c.telefono}","${c.estado}","${c.hora}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="SODIE Clientes Hora 48.csv"');
  res.status(200).send(csvContent);
});

module.exports = router;
