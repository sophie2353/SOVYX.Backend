/**
 * Pasarela Payment Router & On-Chain Verifier - routes/pasarela.js
 * Verificación en tiempo real en la blockchain de Polygon (USDT)
 * Montos: $7,000 en Hora 0 | $6,000 en semanas posteriores (Hora 24, 48, etc.)
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

// Memoria local como fallback de DB si no hay ORM inicializado
const memoryPaymentsDB = new Map();

/**
 * Helper para obtener la wallet destino configurada (WALLET_1 o WALLET_2)
 */
function getTargetWallets() {
  const w1 = (process.env.WALLET_1 || '').toLowerCase().trim();
  const w2 = (process.env.WALLET_2 || '').toLowerCase().trim();
  const wallets = [];
  if (w1) wallets.push(w1);
  if (w2) wallets.push(w2);
  return wallets;
}

/**
 * GET /api/pasarela/get-link
 * Endpoint informativo para consultar los datos de cobro/dirección wallet por id de cliente y hora.
 */
router.get('/get-link', (req, res) => {
  try {
    const { clientId, hours, stage } = req.query;

    const rawId = (clientId || 'CLIENT-01').toString().toUpperCase();
    const elapsedHours = parseInt(hours, 10) || 0;

    // Determinar cuota requerida ($7,000 en Hora 0 / $6,000 en semanas posteriores)
    const isHoraCero = elapsedHours === 0 || stage === 'HORA_0';
    const requiredAmount = isHoraCero ? 7000 : 6000;

    const wallets = getTargetWallets();

    return res.status(200).json({
      success: true,
      clientId: rawId,
      hours: elapsedHours,
      requiredAmount: requiredAmount,
      currency: "USDT",
      network: "Polygon",
      usdtContract: USDT_POLYGON_ADDRESS,
      wallets: wallets,
      blocks: [
        {
          step: 1,
          amount: requiredAmount,
          label: isHoraCero ? "Pago Inicial Hora 0 ($7,000 USDT)" : "Pago Semanal ($6,000 USDT)"
        }
      ]
    });
  } catch (error) {
    console.error('🔥 Error al consultar datos de cobro:', error);
    return res.status(500).json({ success: false, error: 'Error interno en pasarela' });
  }
});

/**
 * POST /api/pasarela/verify-payment
 * Verifica On-Chain la transacción de USDT en Polygon enviada a WALLET_1 o WALLET_2.
 */
router.post('/verify-payment', async (req, res) => {
  try {
    const { txHash, userId, clientId, hours, stage } = req.body;

    const validWallets = getTargetWallets();
    if (validWallets.length === 0) {
      return res.status(500).json({ 
        error: "Configuración de servidor incompleta: No existen WALLET_1 ni WALLET_2 configuradas." 
      });
    }

    if (!txHash) {
      return res.status(400).json({ error: "El Hash de transacción es obligatorio." });
    }

    const cleanTxHash = txHash.trim();

    // A. Consultar si la transacción ya fue procesada previamente
    if (memoryPaymentsDB.has(cleanTxHash)) {
      return res.status(400).json({ error: "Esta transacción ya fue procesada previamente." });
    }

    // B. Obtener el Recibo de la Transacción desde Polygon RPC
    const receipt = await provider.getTransactionReceipt(cleanTxHash);

    if (!receipt) {
      return res.status(404).json({ error: "Transacción no encontrada o aún pendiente de minado en Polygon." });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({ error: "La transacción falló en la Blockchain de Polygon." });
    }

    // C. Determinar el monto exigido según la hora/etapa ($7,000 para Hora 0, $6,000 para las semanas posteriores)
    const elapsedHours = parseInt(hours, 10) || 0;
    const isHoraCero = elapsedHours === 0 || stage === 'HORA_0';
    const requiredAmount = isHoraCero ? 7000 : 6000;

    // D. Analizar los logs buscando la transferencia de USDT hacia WALLET_1 o WALLET_2
    let validPaymentFound = false;
    let amountTransferred = 0;
    let matchedWallet = "";

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === USDT_POLYGON_ADDRESS && log.topics[0] === TRANSFER_TOPIC) {
        
        // Topic 2: Remitente (from), Topic 3: Destinatario (to)
        if (log.topics[2]) {
          const recipientAddress = "0x" + log.topics[2].slice(26).toLowerCase();

          if (validWallets.includes(recipientAddress)) {
            // USDT en Polygon usa 6 decimales
            const rawAmount = BigInt(log.data);
            amountTransferred = Number(rawAmount) / 1e6;

            if (amountTransferred >= requiredAmount) {
              validPaymentFound = true;
              matchedWallet = recipientAddress;
              break;
            }
          }
        }
      }
    }

    if (!validPaymentFound) {
      return res.status(400).json({
        error: `La transacción no corresponde a un envío válido de al menos $${requiredAmount.toLocaleString()} USDT a las wallets oficiales de cobro.`
      });
    }

    // E. Registrar el pago e identificador de confirmación
    const activeUserId = userId || clientId || `CLIENT-01`;
    const postPayId = `PAY-SODE-${Date.now()}`;

    memoryPaymentsDB.set(cleanTxHash, {
      userId: activeUserId,
      txHash: cleanTxHash,
      postPayId,
      amount: amountTransferred,
      matchedWallet,
      status: "verified",
      createdAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: "Pago confirmado exitosamente On-Chain en Polygon.",
      postPayId: postPayId,
      amountVerified: amountTransferred,
      matchedWallet: matchedWallet
    });

  } catch (error) {
    console.error("🔥 Error al verificar transacción On-Chain:", error);
    return res.status(500).json({ error: "Error interno verificando el pago On-Chain." });
  }
});

module.exports = router;
