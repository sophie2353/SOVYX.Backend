// routes/webhook.js
const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

// Asegúrate de requerir dotenv al inicio de tu app principal (index.js o app.js)
// require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

router.post('/contrato-firmado', async (req, res) => {
    const { fullName, email, ipAddress, timestamp, softwareVersion } = req.body;
    const contratoId = 'CT-' + Date.now();

    try {
        await resend.emails.send({
            from: process.env.CORREO_ENVIAR,
            to: process.env.CORREO_RECIBE,
            subject: `Contrato Firmado: ${fullName} (${contratoId})`,
            html: `
                <h2>Nuevo Contrato Registrado</h2>
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

module.exports = router;
