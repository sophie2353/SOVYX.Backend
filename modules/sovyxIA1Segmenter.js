// modules/sovyxIA1Segmenter.js
const sovyxLogger = require('./sovyxLogger');

class IA1Segmenter {
  /**
   * Parseo optimizado para infoproductores:
   * Extrae directamente los identificadores de matcheo + el VALUE.
   * Sin contaminación de nichos ni edades en el CSV.
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
        // Geolocalización pura
        country: (obj.country || obj.pais || obj.geo || 'US').toUpperCase(),
        city: obj.city || obj.ciudad || '',

        // 🎯 Identificadores nativos para Meta Graph API (Schema Match)
        email: obj.email || obj.correo || '',
        phone: obj.phone || obj.telefono || obj.celular || obj.nro || obj.number || '',
        firstName: obj.first_name || obj.firstname || obj.nombre || obj.name || '',
        lastName: obj.last_name || obj.lastname || obj.apellido || '',
        value: parsedValue // Monto en flotante para Value-Based Lookalike
      };
    });
  }

  /**
   * Método principal consumido por uploadRoutes
   * @param {string} fileContent - Contenido del CSV subido
   * @param {object} defaultTargeting - Rango de edad predeterminado asignado en el borrador (ej: { age_min: 25, age_max: 55 })
   */
  segmentarCsv(fileContent, defaultTargeting = {}) {
    const rawData = this.parseCsvToObjects(fileContent);

    // Rango de edad por defecto del borrador (si no se especifica, toma 22 a 55 por defecto)
    const age_min = defaultTargeting.age_min || 25;
    const age_max = defaultTargeting.age_max || 48;
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

    // Extraer lista única de países encontrados en el archivo (Ej: ['CO', 'MX', 'US'])
    const countries = rawData.map(d => d.country);
    const uniqueCountries = [...new Set(countries)];

    // Filtrar usuarios que contengan al menos correo o teléfono
    const usersPayload = rawData.filter(u => u.email || u.phone);

    return {
      nicho: defaultNiche,
      country: uniqueCountries[0] || 'US',
      countriesFound: uniqueCountries, // 👈 Se envía a Meta para crear LALs en cada uno
      age_min,                          // 👈 Mantiene la edad configurada en tu borrador
      age_max,                          // 👈 Mantiene la edad configurada en tu borrador
      totalProcessed: rawData.length,
      usersPayload                       // 👈 Data limpia (Email, Phone, Name, Surname, Country, Value)
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
