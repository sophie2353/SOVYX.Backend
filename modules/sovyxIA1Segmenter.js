// modules/sovyxIA1Segmenter.js
const sovyxLogger = require('./sovyxLogger');

class IA1Segmenter {
  /**
   * Parseo optimizado para infoproductores y ecosistema digital:
   * Extrae exclusivamente identificadores de nombres, ubicación y VALUE.
   * Sin correos, sin teléfonos y con nombres diversificados.
   */
  parseCsvToObjects(fileContent) {
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] || '');

      const rawValue = obj.value || obj.valor || obj.monto || obj.amount || obj.spent || '0';
      const parsedValue = parseFloat(rawValue.replace(/[^0-9.-]+/g, '')) || 0;

      return {
        country: (obj.country || obj.pais || obj.geo || 'US').toUpperCase(),
        city: obj.city || obj.ciudad || '',
        firstName: obj.first_name || obj.firstname || obj.nombre || obj.name || 'carlos',
        lastName: obj.last_name || obj.lastname || obj.apellido || 'mendoza',
        value: parsedValue 
      };
    });
  }

  segmentarCsv(fileContent, defaultTargeting = {}) {
    const rawData = this.parseCsvToObjects(fileContent);

    const age_min = defaultTargeting.age_min || 22;
    const age_max = defaultTargeting.age_max || 55;
    const defaultNiche = defaultTargeting.nicho || 'infoproductos';

    if (!rawData.length) {
      return {
        nicho: defaultNiche,
        country: 'US',
        countriesFound: ['US'],
        age_min,
        age_max,
        totalProcessed: 0,
        usersPayload: []
      };
    }

    const countries = rawData.map(d => d.country);
    const uniqueCountries = [...new Set(countries)];

    // Filtrar garantizando que existan al menos nombres válidos
    const usersPayload = rawData.filter(u => u.firstName || u.lastName);

    return {
      nicho: defaultNiche,
      country: uniqueCountries[0] || 'US',
      countriesFound: uniqueCountries,
      age_min,
      age_max,
      totalProcessed: rawData.length,
      usersPayload
    };
  }

  generarSegmentacion(nicho, esPrimeraVez = true, customParams = {}) {
    if (customParams.rawCsv) {
      return this.segmentarCsv(customParams.rawCsv, customParams);
    }
    return {
      nicho: nicho || 'infoproductos',
      country: customParams.country || 'US',
      countriesFound: [customParams.country || 'US'],
      age_min: customParams.age_min || 22,
      age_max: customParams.age_max || 55,
      totalProcessed: customParams.totalProcessed || 1,
      usersPayload: customParams.usersPayload || []
    };
  }
}

module.exports = IA1Segmenter;
