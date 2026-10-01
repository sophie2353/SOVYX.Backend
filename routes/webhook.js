// routes/webhook.js
const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

// Asegúrate de requerir dotenv al inicio de tu app principal (index.js o app.js)
// require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

// 1. Webhook para Evaluadores (Versión previa)
router.post('/contrato-firmado', async (req, res) => {
    const { fullName, email, ipAddress, timestamp, softwareVersion } = req.body;
    const contratoId = 'CT-' + Date.now();

    try {
        await resend.emails.send({
            from: process.env.CORREO_ENVIAR,
            to: process.env.CORREO_RECIBE,
            subject: `Contrato Firmado: ${fullName} (${contratoId})`,
            html: `
                <h2>Nuevo Contrato Registrado (Evaluador)</h2>
                <p><strong>Cliente:</strong> ${fullName}</p>
                <p><strong>Email del Cliente:</strong> ${email}</p>
                <p><strong>IP:</strong> ${ipAddress}</p>
                <p><strong>Fecha/Hora:</strong> ${timestamp}</p>
                <p><strong>Software:</strong> SODIE v${softwareVersion}</p>
                <p><strong>ID Interno:</strong> ${contratoId}</p>
            `
        });

        res.status(200).json({ success: true, contratoId });
    } catch (error) {
        console.error('Error enviando email:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. NUEVO: Webhook para Firma de Contrato de Lista de Espera V4
router.post('/contrato-waitlist-firmado', async (req, res) => {
    const { clientId, fullName, email, ipAddress, timestamp, softwareVersion, tipoContrato } = req.body;
    const contratoWaitlistId = 'CT-WAITLIST-' + Date.now();

    try {
        await resend.emails.send({
            from: process.env.CORREO_ENVIAR,
            to: process.env.CORREO_RECIBE,
            subject: `🔥 Contrato Waitlist V4 Firmado: ${fullName} [${clientId || 'SIN-ID'}]`,
            html: `
                <h2>Nuevo Contrato de Lista de Espera V4 Registrado</h2>
                <p><strong>Client ID V4:</strong> <span style="color: #d946ef; font-weight: bold;">${clientId || 'N/A'}</span></p>
                <p><strong>Cliente:</strong> ${fullName}</p>
                <p><strong>Email del Cliente:</strong> ${email}</p>
                <p><strong>Tipo de Contrato:</strong> ${tipoContrato || 'LISTA_DE_ESPERA_V4'}</p>
                <p><strong>IP de Firma:</strong> ${ipAddress}</p>
                <p><strong>Fecha/Hora (UTC):</strong> ${timestamp}</p>
                <p><strong>Software / Versión:</strong> SODIE v${softwareVersion || '4.0.0'}</p>
                <p><strong>ID Registro Auditoría:</strong> ${contratoWaitlistId}</p>
            `
        });

        return res.status(200).json({ 
            success: true, 
            message: 'Notificación de contrato de lista de espera enviada correctamente.',
            contratoWaitlistId,
            clientId
        });

    } catch (error) {
        console.error('Error enviando email de contrato waitlist:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
