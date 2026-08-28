const axios = require('axios');
const config = require('../config/tokens');
const Audiencia = require('../models/Audiencia');
const CampaignLog = require('../models/CampaignLog');
const sovyxLogger = require('./sovyxLogger');

class IA1Segmenter {
  constructor() {
    this.metaConfig = config.meta || {
      accessToken: process.env.META_ACCESS_TOKEN,
      adAccountId: process.env.META_AD_ACCOUNT_ID
    };
  }

  // ======================================================
  // 1. LÓGICA ESTADÍSTICA (Moda y Promedios)
  // ======================================================
  getMode(arr) {
    if (!arr || !arr.length) return null;
    const frequency = {};
    let maxFreq = 0;
    let mode = arr[0];

    for (const item of arr) {
      if (!item) continue;
      frequency[item] = (frequency[item] || 0) + 1;
      if (frequency[item] > maxFreq) {
        maxFreq = frequency[item];
        mode = item;
      }
    }
    return mode;
  }

  getAverageAge(ages) {
    const validAges = ages.map(a => Number(a)).filter(a => !isNaN(a) && a > 0);
    if (!validAges.length) return 30; // Edad por defecto
    const sum = validAges.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / validAges.length);
  }

  // ======================================================
  // 2. PARSER Y PROCESADOR DE CSV / DATA CRUDA
  // ======================================================
  parseCsvToObjects(fileContent) {
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return {
        country: obj.country || obj.pais || obj.geo || 'US',
        niche: obj.niche || obj.nicho || obj.category || 'fitness_coach',
        age: parseInt(obj.age || obj.edad || 30, 10)
      };
    });
  }

  // ======================================================
  // 3. SEGMENTACIÓN Y PROCESAMIENTO
  // ======================================================
  segmentarCsv(fileContent, defaultNiche = 'fitness_coach') {
    const rawData = this.parseCsvToObjects(fileContent);

    if (!rawData.length) {
      return {
        nicho: defaultNiche,
        country: 'US',
        ageRange: { min: 22, max: 45 },
        totalProcessed: 0,
        status: 'PAUSED'
      };
    }

    const countries = rawData.map(d => d.country);
    const niches = rawData.map(d => d.niche);
    const ages = rawData.map(d => d.age);

    const topCountry = this.getMode(countries) || 'US';
    const topNiche = this.getMode(niches) || defaultNiche;
    const avgAge = this.getAverageAge(ages);

    return {
      nicho: topNiche,
      country: topCountry,
      ageRange: { 
        min: Math.max(18, avgAge - 5), 
        max: Math.min(65, avgAge + 5) 
      },
      totalProcessed: rawData.length,
      status: 'PAUSED'
    };
  }

  generarSegmentacion(nicho, esPrimeraVez = true, customParams = {}) {
    if (customParams.rawCsv) {
      return this.segmentarCsv(customParams.rawCsv, nicho);
    }

    return {
      nicho: nicho || 'fitness_coach',
      country: customParams.country || 'US',
      ageRange: customParams.ageRange || { min: 22, max: 45 },
      status: esPrimeraVez ? 'PAUSED' : 'ACTIVE',
      totalProcessed: customParams.totalProcessed || 1
    };
  }

  // ======================================================
  // 4. CREACIÓN DE BORRADOR EN META (v25.0) Y REGISTRO EN BD
  // ======================================================
  async procesarYLanzarBorrador(rawData, sessionId = null) {
    try {
      if (!Array.isArray(rawData) || !rawData.length) {
        throw new Error('La data cruda para procesar no es válida o está vacía.');
      }

      // 1. Procesamiento Estadístico
      const countries = rawData.map(d => d.country);
      const niches = rawData.map(d => d.niche);
      const ages = rawData.map(d => d.age);

      const topCountry = this.getMode(countries) || 'US';
      const topNiche = this.getMode(niches) || 'fitness_coach';
      const avgAge = this.getAverageAge(ages);

      const aggregatedSegment = {
        country: topCountry,
        niche: topNiche,
        ageRange: { min: Math.max(18, avgAge - 5), max: Math.min(65, avgAge + 5) },
        totalProcessed: rawData.length
      };

      // 2. Creación del Borrador en Meta Ads v25.0
      const { accessToken, adAccountId } = this.metaConfig;
      
      let campaignId = `cmp_mock_${Date.now()}`;

      if (accessToken && adAccountId) {
        const metaResponse = await axios.post(
          `https://graph.facebook.com/v25.0/act_${adAccountId}/campaigns`,
          {
            name: `SOVYX Draft - ${topNiche} (${topCountry})`,
            objective: 'OUTCOME_LEADS',
            status: 'PAUSED',
            special_ad_categories: ['NONE'],
            access_token: accessToken
          }
        );
        campaignId = metaResponse.data.id;
      } else {
        if (sovyxLogger) sovyxLogger.info('⚠️ Meta tokens no configurados. Usando ID simulado.');
      }

      // 3. REGISTRO EN BD PARA LA IA3
      const campaignLog = await CampaignLog.create({
        metaCampaignId: campaignId,
        sessionId: sessionId || 'sess_default',
        initialTargeting: aggregatedSegment,
        status: 'DRAFT',
        createdAt: new Date()
      });

      // 4. Actualizar Audiencia en Mongo si existe sesión
      if (sessionId) {
        await Audiencia.findOneAndUpdate(
          { sessionId },
          { 
            estado: 'PENDIENTE_CONFIRMACION', 
            metaCampaignId: campaignId,
            segmentacion: aggregatedSegment 
          }
        );
      }

      if (sovyxLogger) {
        sovyxLogger.info('SOVYX IA1: Borrador creado y log guardado para IA3', { 
          campaignId, 
          topNiche 
        });
      }

      return {
        success: true,
        campaignId,
        segmentation: aggregatedSegment,
        logId: campaignLog._id
      };

    } catch (error) {
      const errorMsg = error.response?.data || error.message;
      if (sovyxLogger) sovyxLogger.error('Error procesando borrador en IA1:', errorMsg);
      throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
    }
  }

  // Método de aprendizaje cuando la IA3 le envía feedback
  actualizarPatrones(resultados) {
    if (sovyxLogger) {
      sovyxLogger.info('IA1: Patrones de targeting actualizados por la IA3 👺', { resultados });
    }
    return true;
  }
}

module.exports = IA1Segmenter;
