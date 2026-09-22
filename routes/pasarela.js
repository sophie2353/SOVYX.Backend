/**
 * Pasarela Payment Router & On-Chain Verifier - routes/pasarela.js
 * Verificación en tiempo real en la blockchain de Polygon (USDT)
 * 
 * Reglas de Cobro:
 * - Hora 0: 3 Pagos de $7,000 USDT.
 * - Semana 1 a 3: $6,000 USDT según la solicitud del cliente (CLIENT-01, CLIENT-02, CLIENT-03).
 * Destino único: WALLET_1
 */

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');

// 1. Proveedor RPC público de Polygon
const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");

// Dirección oficial de USDT en Polygon (ERC-20 / PRC-20)
const USDT_POLYGON_ADDRESS = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f".toLowerCase();

// Firma de evento ERC-20: Transfer(address,address,uint256)
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

// Memoria local para prevenir doble gasto / réplicas de hashes
const memoryPaymentsDB = new Map();

/**
 * Obtiene la wallet única destino configurada en WALLET_1
 */
function getTargetWallet() {
  const w1 = (process.env.WALLET_1 || '').toLowerCase().trim();
  if (!w1) {
    throw new Error("Configuración incompleta: WALLET_1 no está configurada en las variables de entorno.");
  }
  return w1;
}

/**
 * Extrae las 3 iniciales / identificador corto a partir del clientId
 */
function extractClientInitials(clientId) {
  if (!clientId) return 'CLI';
  const clean = clientId.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean.substring(0, 3) || 'CLI';
}

/**
 * Helper para determinar el monto esperado según la etapa y solicitud del cliente
 */
function calculateRequiredAmount(stage, hours) {
  const elapsedHours = parseInt(hours, 10) || 0;
  const isHoraCero = stage === 'HORA_0' || elapsedHours === 0;

  // Hora 0 = $7,000 | Semanas posteriores (1 a 3) = $6,000
  return isHoraCero ? 7000 : 6000;
}

/**
 * GET /api/pasarela/get-link
 * Consulta de datos de cobro invocada por client.js o la interfaz
 */
router.get('/get-link', (req, res) => {
  try {
    const { clientId, hours, stage } = req.query;

    const targetWallet = getTargetWallet();
    const rawId = (clientId || 'CLIENT-01').toString().toUpperCase();
    const initials = extractClientInitials(rawId);
    
    const requiredAmount = calculateRequiredAmount(stage, hours);
    const isHoraCero = requiredAmount === 7000;

    return res.status(200).json({
      success: true,
      clientId: rawId,
      initials: initials,
      stage: isHoraCero ? 'HORA_0' : 'SEMANAL',
      requiredAmount: requiredAmount,
      currency: "USDT",
      network: "Polygon",
      usdtContract: USDT_POLYGON_ADDRESS,
      targetWallet: targetWallet,
      summary: isHoraCero 
        ? "Hora 0: Corresponde a uno de los 3 pagos de $7,000 USDT" 
        : `Semana activa para ${rawId}: Pago de $6,000 USDT`
    });
  } catch (error) {
    console.error('🔥 Error al consultar datos de cobro:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error interno en pasarela' });
  }
});

/**
 * POST /api/pasarela/verify-payment
 * Verifica la transacción USDT On-Chain en Polygon contra WALLET_1.
 * Retorna la señal para que el HTML redirija a la confirmación e invoque la ruta del ID.
 */
router.post('/verify-payment', async (req, res) => {
  try {
    const { txHash, clientId, hours, stage } = req.body;

    const targetWallet = getTargetWallet();

    if (!txHash) {
      return res.status(400).json({ error: "El Hash de transacción (txHash) es obligatorio." });
    }

    const cleanTxHash = txHash.trim();
    const activeClientId = (clientId || 'CLIENT-01').toString().toUpperCase();
    const initials = extractClientInitials(activeClientId);

    // A. Evitar reuso de transacciones procesadas
    if (memoryPaymentsDB.has(cleanTxHash)) {
      return res.status(400).json({ error: "Esta transacción ya fue verificada y procesada previamente." });
    }

    // B. Obtener Recibo de Transacción en Polygon
    const receipt = await provider.getTransactionReceipt(cleanTxHash);

    if (!receipt) {
      return res.status(404).json({ error: "Transacción no encontrada o aún pendiente de minado en Polygon." });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({ error: "La transacción falló en la Blockchain de Polygon." });
    }

    // C. Determinar monto esperado ($7,000 para Hora 0, $6,000 para semanas)
    const requiredAmount = calculateRequiredAmount(stage, hours);

    // D. Verificar On-Chain el evento Transfer a WALLET_1
    let validPaymentFound = false;
    let amountTransferred = 0;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === USDT_POLYGON_ADDRESS && log.topics[0] === TRANSFER_TOPIC) {
        
        if (log.topics[2]) {
          const recipientAddress = "0x" + log.topics[2].slice(26).toLowerCase();

          if (recipientAddress === targetWallet) {
            // Decodificar 6 decimales de USDT
            const rawAmount = BigInt(log.data);
            amountTransferred = Number(rawAmount) / 1e6;

            if (amountTransferred >= requiredAmount) {
              validPaymentFound = true;
              break;
            }
          }
        }
      }
    }

    if (!validPaymentFound) {
      return res.status(400).json({
        error: `Transacción no válida. Se requerían al menos $${requiredAmount.toLocaleString()} USDT dirigidos a ${targetWallet}.`
      });
    }

    // E. Generar identificador temporal de verificación y guardar en memoria
    const tempVerificationId = `VERIF-${initials}-${Date.now()}`;

    memoryPaymentsDB.set(cleanTxHash, {
      clientId: activeClientId,
      initials: initials,
      txHash: cleanTxHash,
      tempVerificationId,
      amount: amountTransferred,
      targetWallet,
      verifiedAt: new Date()
    });

    // F. Responder al cliente para dar paso a la confirmación HTML y la llamada a la ruta que asigna el ID definitivo
    return res.status(200).json({
      success: true,
      redirectConfirm: true,
      clientId: activeClientId,
      initials: initials,
      amountVerified: amountTransferred,
      txHash: cleanTxHash,
      tempVerificationId: tempVerificationId,
      nextStepUrl: "/confirmacion.html"
    });

  } catch (error) {
    console.error("🔥 Error al verificar transacción On-Chain:", error);
    return res.status(500).json({ error: error.message || "Error interno verificando el pago On-Chain." });
  }
});

module.exports = router;
