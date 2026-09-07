// modules/sovyxIA1Segmenter.js
const sovyxLogger = require('./sovyxLogger');

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

  /**
   * Parseo del CSV: Extrae metadatos y conserva identificadores + VALUE para LAL
   */
  parseCsvToObjects(fileContent) {
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];

    // Limpiar encabezados
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] || '');

      // Extraer y limpiar el valor numérico invertido/comprado (VALUE)
      const rawValue = obj.value || obj.valor || obj.monto || obj.amount || obj.spent || '0';
      const parsedValue = parseFloat(rawValue.replace(/[^0-9.-]+/g, '')) || 0;

      return {
        // Datos de geolocalización y nicho
        country: (obj.country || obj.pais || obj.geo || 'US').toUpperCase(),
        city: obj.city || obj.ciudad || '',
        niche: obj.niche || obj.nicho || obj.category || '',
        age: parseInt(obj.age || obj.edad || 30, 10),

        // 🎯 Datos para inyección en Meta Graph API (Schema Match)
        email: obj.email || obj.correo || '',
        phone: obj.phone || obj.telefono || obj.celular || obj.nro || '',
        firstName: obj.first_name || obj.firstname || obj.nombre || obj.name || '',
        lastName: obj.last_name || obj.lastname || obj.apellido || '',
        value: parsedValue // Monto en flotante para Value-Based Lookalike
      };
    });
  }

  /**
   * Método principal consumido por tus rutas de backend
   */
  segmentarCsv(fileContent, defaultNiche = 'fitness_coach') {
    const rawData = this.parseCsvToObjects(fileContent);

    if (!rawData.length) {
      return {
        nicho: defaultNiche,
        country: 'US',
        countriesFound: ['US'],
        age_min: 22,
        age_max: 45,
        totalProcessed: 0,
        usersPayload: []
      };
    }

    const countries = rawData.map(d => d.country);
    const cities = rawData.map(d => d.city).filter(Boolean);
    const niches = rawData.map(d => d.niche).filter(Boolean);
    const ages = rawData.map(d => d.age);

    const uniqueCountries = [...new Set(countries)];
    const topCountry = this.getMode(countries) || 'US';
    const topCity = this.getMode(cities);
    const topNiche = this.getMode(niches) || defaultNiche;
    const avgAge = this.getAverageAge(ages);

    // Filtrar solo usuarios que tengan al menos Email o Teléfono para la semilla de Meta
    const usersPayload = rawData.filter(u => u.email || u.phone);

    return {
      nicho: topNiche,
      country: topCountry,
      countriesFound: uniqueCountries, // 👈 Se envía la lista completa de países detectados
      ...(topCity ? { city: topCity } : {}),
      age_min: Math.max(18, avgAge - 5),
      age_max: Math.min(65, avgAge + 5),
      totalProcessed: rawData.length,
      usersPayload // 👈 AQUÍ SE MANTIENE LA DATA INDIVIDUAL
    };
  }

  generarSegmentacion(nicho, esPrimeraVez = true, customParams = {}) {
    if (customParams.rawCsv) {
      return this.segmentarCsv(customParams.rawCsv, nicho);
    }
    return {
      nicho: nicho || 'fitness_coach',
      country: customParams.country || 'US',
      countriesFound: [customParams.country || 'US'],
      age_min: 22,
      age_max: 45,
      totalProcessed: customParams.totalProcessed || 1,
      usersPayload: customParams.usersPayload || []
    };
  }
}

module.exports = IA1Segmenter;
