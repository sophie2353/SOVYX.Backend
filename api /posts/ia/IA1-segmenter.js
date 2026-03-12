// modules/sovyxIA1Segmenter.js - VERSIÓN MEJORADA
const sovyxLogger = require('./sovyxLogger');

class SOVYXIA1Segmenter {
  constructor(historicalData) {
    this.historicalData = historicalData || { months: 36, patterns: [] };
    this.nichos = this.cargarNichos();
  }
  
  // ============================================
  // BASE DE DATOS DE NICHOS (expansible)
  // ============================================
  cargarNichos() {
    return {
      // 🏋️ FITNESS & COACHING
      fitness_coach: {
        nombre: "Fitness Coach",
        keywords: ["personal training", "gym", "fitness", "entrenador", "coach deportivo"],
        edades: [25, 55],
        intereses: [
          { id: "102055209874219", name: "Personal Training/Fitness" },
          { id: "175688879130027", name: "Coaching & Mentoring" },
          { id: "379484855552546", name: "Life coaching" }
        ],
        comportamientos: ["fitness", "salud", "bienestar"],
        copy_ejemplos: {
          problema: "¿Tienes clientes pero no escalas tu negocio fitness?",
          sueno: "Imagina 50 clientes de coaching de alto nivel",
          social: "Mi cliente coach fitness facturó 47,000€ en una semana"
        }
      },
      
      // 🎬 EDITORES / CREATIVOS
      editor: {
        nombre: "Editor de Video",
        keywords: ["video editing", "premiere", "after effects", "da vinci", "editor"],
        edades: [22, 45],
        intereses: [
          { id: "123456789", name: "Video Editing" },
          { id: "987654321", name: "Content Creation" },
          { id: "456789123", name: "YouTube Creators" }
        ],
        comportamientos: ["creativos", "youtubers", "producción"],
        copy_ejemplos: {
          problema: "¿Pasas horas editando y no cobras lo que vales?",
          sueno: "Gana 5,000$ por proyecto de edición",
          social: "Editores que pasaron de 500$ a 5,000$ por video"
        }
      },
      
      // 💰 FINTECH / INVERSIONES
      fintech: {
        nombre: "Inversor / Fintech",
        keywords: ["inversiones", "crypto", "trading", "fintech", "bolsa"],
        edades: [28, 60],
        intereses: [
          { id: "6003298262463", name: "Cryptocurrency" },
          { id: "6003417266467", name: "Stock trading" },
          { id: "6003458267468", name: "Passive income" }
        ],
        comportamientos: ["inversores", "traders", "finanzas"],
        copy_ejemplos: {
          problema: "¿Inviertes pero no ves retornos consistentes?",
          sueno: "Automatiza tus inversiones con IA",
          social: "Cómo pasé de 1,000$ a 50,000$ en crypto"
        }
      },
      
      // 🤖 AUTOMATIZACIÓN / IA
      automatizacion: {
        nombre: "Automatización / IA",
        keywords: ["automatización", "ia", "chatbot", "no code", "make", "zapier"],
        edades: [24, 50],
        intereses: [
          { id: "6003317269464", name: "Online business" },
          { id: "6003358264465", name: "E-commerce" },
          { id: "6003179268665", name: "Business coaching" }
        ],
        comportamientos: ["emprendedores", "tech", "automatización"],
        copy_ejemplos: {
          problema: "¿Todavía haces tareas manuales que una IA puede hacer?",
          sueno: "Tu negocio funcionando solo 24/7",
          social: "Automaticé mi negocio y ahora gano mientras duermo"
        }
      },
      
      // 📸 FOTOGRAFÍA
      fotografo: {
        nombre: "Fotógrafo",
        keywords: ["fotografía", "photoshop", "lightroom", "cámara", "fotos"],
        edades: [22, 50],
        intereses: [
          { id: "234567890", name: "Photography" },
          { id: "345678901", name: "Adobe Photoshop" }
        ],
        comportamientos: ["creativos", "arte", "visual"],
        copy_ejemplos: {
          problema: "¿Tomas fotos increíbles pero no encuentras clientes?",
          sueno: "Vende tus fotos como high ticket",
          social: "Fotógrafos que pasaron de 200$ a 3,000$ por sesión"
        }
      },
      
      // 🎓 EDUCACIÓN / CURSOS
      educador: {
        nombre: "Creador de Cursos",
        keywords: ["cursos", "educación", "online course", "enseñar", "formación"],
        edades: [26, 55],
        intereses: [
          { id: "456789012", name: "Online Education" },
          { id: "567890123", name: "E-learning" }
        ],
        comportamientos: ["educadores", "formadores", "coaches"],
        copy_ejemplos: {
          problema: "¿Tienes conocimiento pero no sabes venderlo?",
          sueno: "100 alumnos pagando 500$ por tu curso",
          social: "De profesor a creador de cursos de 5,000$"
        }
      }
    };
  }
  
  // ============================================
  // GENERAR SEGMENTACIÓN SEGÚN NICHO
  // ============================================
  generarSegmentacion(nicho, customParams = {}) {
    sovyxLogger.info(`IA1: Generando segmentación para ${nicho}`);
    
    const base = this.nichos[nicho] || this.nichos.fitness_coach; // default
    
    // Segmentación base del nicho
    const segmentacion = {
      nicho: base.nombre,
      name: `SOVYX - ${base.nombre}`,
      audience_size: 2700000,
      age_min: customParams.edad_min || base.edades[0],
      age_max: customParams.edad_max || base.edades[1],
      geo_locations: {
        countries: customParams.paises || ['US', 'CA', 'AU', 'CO'],
        cities: customParams.ciudades || [],
        location_types: ["home", "recent"]
      },
      locales: customParams.locales || [23, 7], // Español + Inglés
      interests: base.intereses,
      flexible_spec: [
        {
          interests: base.intereses.slice(0, 2),
          behaviors: [{ id: "6002714895572", name: "Frequent Travelers" }]
        }
      ]
    };
    
    // Si hay ciudades específicas
    if (customParams.ciudades && customParams.ciudades.length > 0) {
      segmentacion.geo_locations.cities = customParams.ciudades.map(ciudad => ({
        key: ciudad.key || ciudad,
        name: ciudad.name || ciudad,
        country: ciudad.country || 'US'
      }));
    }
    
    // Si hay keywords adicionales
    if (customParams.keywords) {
      segmentacion.keywords = customParams.keywords;
    }
    
    return segmentacion;
  }
  
  // ============================================
  // GENERAR COPY SEGÚN NICHO
  // ============================================
  generarCopy(nicho, tipo, customMessage = '') {
    const base = this.nichos[nicho] || this.nichos.fitness_coach;
    
    let copy = base.copy_ejemplos[tipo] || base.copy_ejemplos.problema;
    
    // Personalizar si hay mensaje del usuario
    if (customMessage) {
      copy = customMessage + ' ' + copy;
    }
    
    return copy;
  }
  
  // ============================================
  // SUGERIR NICHOS BASADO EN KEYWORDS
  // ============================================
  sugerirNichos(keywords) {
    const sugerencias = [];
    const palabras = keywords.toLowerCase().split(' ');
    
    for (const [key, nicho] of Object.entries(this.nichos)) {
      let matchCount = 0;
      for (const palabra of palabras) {
        if (nicho.keywords.some(k => k.includes(palabra))) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        sugerencias.push({
          nicho: key,
          nombre: nicho.nombre,
          confianza: Math.min(100, matchCount * 20)
        });
      }
    }
    
    return sugerencias.sort((a, b) => b.confianza - a.confianza);
  }
  
  // ============================================
  // AÑADIR NUEVO NICHO (para expansión futura)
  // ============================================
  añadirNichos(nuevosNichos) {
    this.nichos = { ...this.nichos, ...nuevosNichos };
    sovyxLogger.info('IA1: Nuevos nichos añadidos', { cantidad: Object.keys(nuevosNichos).length });
  }
}

module.exports = SOVYXIA1Segmenter;
