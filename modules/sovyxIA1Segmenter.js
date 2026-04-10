const sovyxLogger = require('./sovyxLogger');

class SOVYXIA1Segmenter {
  constructor(historicalData) {
    this.historicalData = historicalData || { months: 36, patterns: [] };
    this.nichos = this.cargarNichos();
  
    this.premiumFilters = {
      behaviors: [
        { id: "6003088812345", name: "Frequent International Travelers" },
        { id: "6003088812346", name: "Facebook Page Admins" }
      ],
      exclusions: [
        { id: "6003104416371", name: "Free Software" },
        { id: "6003082330171", name: "Cheap" },
        { id: "6003070413371", name: "Discount" },
        { id: "6002996452171", name: "Scholarship" }
      ]
    };
  }


  cargarNichos() {
    return {
      fitness_coach: {
        nombre: "Fitness Coach",
        keywords: ["personal training", "gym", "fitness", "entrenador"],
        edades: [25, 55],
        intereses: [
          { id: "102055209874219", name: "Personal Training/Fitness" },
          { id: "175688879130027", name: "Coaching & Mentoring" }
        ],
        copy: { problema: "¿No escalas tu negocio fitness?", sueno: "50 clientes de coaching de alto nivel" }
      },
      editor: {
        nombre: "Editor de Video",
        keywords: ["video editing", "premiere", "after effects", "da vinci"],
        edades: [22, 45],
        intereses: [
          { id: "123456789", name: "Video Editing" },
          { id: "987654321", name: "Content Creation" }
        ],
        copy: { problema: "¿Editas mucho y cobras poco?", sueno: "Proyectos de 5,000$ por edición" }
      },
      fintech: {
        nombre: "Inversor / Fintech",
        keywords: ["inversiones", "crypto", "trading", "bolsa"],
        edades: [28, 60],
        intereses: [
          { id: "6003298262463", name: "Cryptocurrency" },
          { id: "6003417266467", name: "Stock trading" }
        ],
        copy: { problema: "¿Inviertes sin retornos reales?", sueno: "Automatiza tus inversiones con IA" }
      },
      automatizacion: {
        nombre: "Automatización / IA",
        keywords: ["automatización", "ia", "chatbot", "no code"],
        edades: [24, 50],
        intereses: [
          { id: "6003317269464", name: "Online business" },
          { id: "6003358264465", name: "E-commerce" }
        ],
        copy: { problema: "¿Sigues haciendo tareas manuales?", sueno: "Negocio funcionando solo 24/7" }
      },
      fotografo: {
        nombre: "Fotógrafo",
        keywords: ["fotografía", "photoshop", "cámara"],
        edades: [22, 50],
        intereses: [
          { id: "234567890", name: "Photography" },
          { id: "345678901", name: "Adobe Photoshop" }
        ],
        copy: { problema: "¿Tomas fotos pero no vendes?", sueno: "Sesiones high ticket de 3,000$" }
      },
      educador: {
        nombre: "Creador de Cursos",
        keywords: ["cursos", "online course", "enseñar"],
        edades: [26, 55],
        intereses: [
          { id: "456789012", name: "Online Education" },
          { id: "567890123", name: "E-learning" }
        ],
        copy: { problema: "¿Conocimiento que no vendes?", sueno: "Alumnos pagando 500$ por tu curso" }
      }
    };
  }

  generarSegmentacion(nicho, isFirstTime = true, customParams = {}) {
    sovyxLogger.info(`IA1: Generando segmentación para ${nicho}. Modo: ${isFirstTime ? 'PAUSED/BORRADOR' : 'ACTIVE'}`);
    
    const base = this.nichos[nicho] || this.nichos.fitness_coach;

    return {
      
      status: isFirstTime ? 'PAUSED' : 'ACTIVE',
      
      name: `SOVYX_${base.nombre}_${new Date().getTime()}`,
      optimization_goal: "REPLIES", 
      billing_event: "IMPRESSIONS",
      
      targeting: {
        age_min: customParams.edad_min || base.edades[0],
        age_max: customParams.edad_max || base.edades[1],
        geo_locations: {
          countries: customParams.paises || ['US', 'ES', 'MX', 'CO'],
          location_types: ["home"]
        },
        
        flexible_specifications: [
          { interests: base.intereses },
          { behaviors: this.premiumFilters.behaviors }
        ],
      
        exclusions: {
          interests: this.premiumFilters.exclusions
        },
        publisher_platforms: ["instagram"],
        device_platforms: ["mobile"]
      }
    };
  }

  generarCopy(nicho, tipo) {
    const base = this.nichos[nicho] || this.nichos.fitness_coach;
    return base.copy[tipo] || base.copy.problema;
  }

  sugerirNichos(keywords) {
    const sugerencias = [];
    const palabras = keywords.toLowerCase().split(' ');
    
    for (const [key, nicho] of Object.entries(this.nichos)) {
      let matchCount = 0;
      palabras.forEach(p => {
        if (nicho.keywords.some(k => k.includes(p))) matchCount++;
      });
      if (matchCount > 0) {
        sugerencias.push({ nicho: key, nombre: nicho.nombre, confianza: Math.min(100, matchCount * 25) });
      }
    }
    return sugerencias.sort((a, b) => b.confianza - a.confianza);
  }
}

module.exports = SOVYXIA1Segmenter;
