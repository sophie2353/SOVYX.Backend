// modules/sovyxIA1Segmenter.js
const sovyxLogger = require('./sovyxLogger'); // O '../modules/sovyxLogger' según tu estructura

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

  parseCsvToObjects(fileContent) {
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] || '');
      return {
        country: obj.country || obj.pais || obj.geo || 'US',
        city: obj.city || obj.ciudad || '',
        niche: obj.niche || obj.nicho || obj.category || '',
        age: parseInt(obj.age || obj.edad || 30, 10)
      };
    });
  }

  // Método consumido por uploadRoutes.js
  segmentarCsv(fileContent, defaultNiche = 'fitness_coach') {
    const rawData = this.parseCsvToObjects(fileContent);

    if (!rawData.length) {
      return {
        nicho: defaultNiche,
        country: 'US',
        age_min: 22,
        age_max: 45,
        totalProcessed: 0
      };
    }

    const countries = rawData.map(d => d.country);
    const cities = rawData.map(d => d.city).filter(Boolean);
    const niches = rawData.map(d => d.niche).filter(Boolean);
    const ages = rawData.map(d => d.age);

    const topCountry = this.getMode(countries) || 'US';
    const topCity = this.getMode(cities);
    const topNiche = this.getMode(niches) || defaultNiche;
    const avgAge = this.getAverageAge(ages);

    return {
      nicho: topNiche,
      country: topCountry,
      ...(topCity ? { city: topCity } : {}),
      age_min: Math.max(18, avgAge - 5),
      age_max: Math.min(65, avgAge + 5),
      totalProcessed: rawData.length
    };
  }

  generarSegmentacion(nicho, esPrimeraVez = true, customParams = {}) {
    if (customParams.rawCsv) {
      return this.segmentarCsv(customParams.rawCsv, nicho);
    }
    return {
      nicho: nicho || 'fitness_coach',
      country: customParams.country || 'US',
      age_min: 22,
      age_max: 45,
      totalProcessed: customParams.totalProcessed || 1
    };
  }
}

module.exports = IA1Segmenter;
