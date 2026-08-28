// modules/sovyxIA1Segmenter.js
const Audiencia = require('../models/Audiencia');
const sovyxLogger = require('../modules/sovyxLogger');

class IA1Segmenter {

  getMode(arr) {
    if (!arr || !arr.length) return null;
    const freq = {};
    let max = 0, mode = arr[0];
    for (const item of arr) {
      if (!item) continue;
      freq[item] = (freq[item] || 0) + 1;
      if (freq[item] > max) { max = freq[item]; mode = item; }
    }
    return mode;
  }

  getAverageAge(ages) {
    const valid = ages.map(a => Number(a)).filter(a => !isNaN(a) && a > 0);
    return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 30;
  }

  // 1. Generaliza miles de registros de data (edad, email, nicho, país, ciudad)
  parseAndGeneralizeCsv(fileContent) {
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rawData = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] || '');
      return {
        country: obj.country || obj.pais || 'US',
        city: obj.city || obj.ciudad || '',
        niche: obj.niche || obj.nicho || 'marketing',
        age: parseInt(obj.age || obj.edad || 30, 10)
      };
    });

    const countries = rawData.map(d => d.country);
    const cities = rawData.map(d => d.city).filter(Boolean);
    const niches = rawData.map(d => d.niche);
    const ages = rawData.map(d => d.age);

    const topCountry = this.getMode(countries) || 'US';
    const topCity = this.getMode(cities);
    const topNiche = this.getMode(niches) || 'marketing';
    const avgAge = this.getAverageAge(ages);

    return {
      nicho: topNiche,
      country: topCountry,
      city: topCity,
      ageRange: {
        min: Math.max(18, avgAge - 5),
        max: Math.min(65, avgAge + 5)
      },
      totalProcessed: rawData.length
    };
  }

  // 2. Almacena en la BD (Audiencia)
  async procesarYGuardarSegmentacion(fileContent, sessionId) {
    const generalData = this.parseAndGeneralizeCsv(fileContent);
    if (!generalData) throw new Error('No se pudo extraer data suficiente del archivo CSV.');

    const audiencia = await Audiencia.findOneAndUpdate(
      { sessionId },
      {
        estado: 'PENDIENTE_CONFIRMACION',
        segmentacion: generalData
      },
      { upsert: true, new: true }
    );

    if (sovyxLogger) {
      sovyxLogger.info('IA1: Segmentación procesada y guardada en Audiencia', {
        sessionId,
        topNiche: generalData.nicho,
        totalProcessed: generalData.totalProcessed
      });
    }

    return { success: true, segmentation: generalData, audienciaId: audiencia._id };
  }
}

module.exports = IA1Segmenter;
