const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config/tokens');
const sovyxLogger = require('./sovyxLogger');

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

class GeminiService {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: config.gemini.model });
  }

  /**
   * Analiza la estructura de un curso/negocio y escupe la estrategia de IG
   */
  async analizarEstrategiaOnboarding(datosCliente) {
    const prompt = `
      Eres el estratega jefe de SOVYX. Tu objetivo es escalar este negocio a High Ticket.
      
      DATOS DEL CLIENTE:
      - Nombre: ${datosCliente.nombre}
      - Nicho: ${datosCliente.nicho}
      - Promesa: ${datosCliente.promesa}
      - Detalles del Curso: ${datosCliente.contenido}

      TAREAS:
      1. Define el "Dolor Agudo" que resuelve.
      2. Crea una estructura de 5 historias de Instagram (Hook, Valor, Deseo, Escasez, CTA).
      3. Sugiere 3 Keywords de segmentación para la IA1.
      4. Define el tono de voz para la IA2.

      Responde estrictamente en formato JSON.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text().replace(/```json|```/g, ''));
    } catch (error) {
      sovyxLogger.error('Gemini Error:', { error: error.message });
      return null;
    }
  }

  /**
   * Analiza capturas de pantalla de métricas o de pagos (Binance/Stripe)
   */
  async analizarImagenPago(imageBuffer, mimeType) {
    const prompt = "Analiza esta imagen. ¿Es un comprobante de pago válido? Extrae: Monto, Fecha y ID de transacción. Responde en JSON.";
    
    try {
      const result = await this.model.generateContent([
        prompt,
        { inlineData: { data: imageBuffer.toString("base64"), mimeType } }
      ]);
      const response = await result.response;
      return JSON.parse(response.text().replace(/```json|```/g, ''));
    } catch (e) {
      return { error: "No se pudo validar la imagen" };
    }
  }
}

module.exports = new GeminiService();
