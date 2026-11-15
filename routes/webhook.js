const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Función para enviar el contrato firmado automáticamente al cliente (sendContractClient)
 */
async function sendContractClient(clientData) {
    const { fullName, email, contractId, clientId, timestamp, ipAddress, softwareVersion } = clientData;
    
    await resend.emails.send({
        from: process.env.CORREO_ENVIAR,
        to: email, // Extraído directamente del formulario del cliente
        subject: `Copia de Contrato Digital Registrado - SODIE v${softwareVersion} (${contractId})`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #0b0218; color: #fff; border-radius: 12px; border: 1px solid rgba(0,255,204,0.3);">
                <h2 style="color: #00ffcc; margin-top: 0;">¡Contrato Digital Firmado con Éxito!</h2>
                <p>Hola <strong>${fullName}</strong>,</p>
                <p>Este correo sirve como constancia y copia oficial de su contrato legal de prestación de servicios para la inyección automatizada en SODIE v4.</p>
                
                <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 4px 0;"><strong>ID de Contrato:</strong> ${contractId}</p>
                    <p style="margin: 4px 0;"><strong>Identificador Corporativo:</strong> ${clientId || 'CLIENTE-REGISTRADO'}</p>
                    <p style="margin: 4px 0;"><strong>Fecha y Hora de Firma (ISO):</strong> ${timestamp}</p>
                    <p style="margin: 4px 0;"><strong>Dirección IP Respaldada:</strong> ${ipAddress}</p>
                    <p style="margin: 4px 0;"><strong>Versión del Sistema:</strong> SODIE v${softwareVersion}</p>
                </div>

                <p style="color: #a1a1aa; font-size: 0.85rem; margin-top: 20px;">Guarde este correo en sus registros corporativos. El sistema ya procesó sus credenciales para la apertura del borrador en Meta.</p>
            </div>
        `
    });
}

// Webhook unificado para procesar la firma del contrato y disparar ambos correos
router.post('/contrato-firmado', async (req, res) => {
    const { fullName, email, ipAddress, timestamp, softwareVersion, contractId, clientId } = req.body;
    
    // Si el contrato viene con ID desde el frontend (ej. C-#01 o C-ADMIN), lo usa; de lo contrario crea uno de respaldo
    const finalContractId = contractId || ('C-' + (clientId ? clientId.replace('#', '') : Date.now()));
    const finalSoftwareVersion = softwareVersion || '4.0.0';

    try {
        // 1. Enviar notificación interna a tu correo corporativo (Admin)
        await resend.emails.send({
            from: process.env.CORREO_ENVIAR,
            to: process.env.CORREO_RECIBE,
            subject: `Contrato Firmado: ${fullName} (${finalContractId} / ${clientId || 'N/A'})`,
            html: `
                <h2>Nuevo Contrato Registrado (Panel Admin)</h2>
                <p><strong>Cliente:</strong> ${fullName}</p>
                <p><strong>ID de Cliente:</strong> ${clientId || 'No especificado'}</p>
                <p><strong>ID de Contrato:</strong> ${finalContractId}</p>
                <p><strong>Email del Cliente:</strong> ${email}</p>
                <p><strong>IP de Seguridad:</strong> ${ipAddress}</p>
                <p><strong>Fecha/Hora:</strong> ${timestamp}</p>
                <p><strong>Software:</strong> SODIE v${finalSoftwareVersion}</p>
            `
        });

        // 2. Enviar automáticamente la copia del contrato al cliente (sendContractClient)
        if (email) {
            await sendContractClient({
                fullName,
                email,
                contractId: finalContractId,
                clientId,
                timestamp,
                ipAddress,
                softwareVersion: finalSoftwareVersion
            });
        }

        res.status(200).json({ success: true, contractId: finalContractId });
    } catch (error) {
        console.error('Error enviando emails de contrato:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
