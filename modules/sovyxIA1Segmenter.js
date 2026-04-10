const sovyxLogger = require('./sovyxLogger');
const fs = require('fs');
const path = require('path');

class SOVYXIA1Segmenter {
  constructor() {
    this.nichos = this.cargarNichos();
    this.premiumFilters = this.cargarFiltrosElite();
    this.masterTargeting = this.cargarMasterTargeting();
    // Ruta de aprendizaje de IA3
    this.learningPath = path.join(__dirname, '../data/ia3_learning.json');
  }

  cargarMasterTargeting() {
    try {
      const masterPath = path.join(__dirname, '../data/targeting/sovyxtargeting.json');
      if (fs.existsSync(masterPath)) {
        const data = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
        sovyxLogger.info('IA1: Patrón Maestro cargado con éxito 👺💅🏽');
        return data;
      }
      return null;
    } catch (e) {
      sovyxLogger.error('IA1: Error cargando sovyxtargeting.json', { error: e.message });
      return null;
    }
  }

  cargarFiltrosElite() {
    return {
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
        use_master: true, 
        keywords: ["personal training", "gym", "fitness"],
        edades: [25, 55],
        intereses: [{ id: "102055209874219", name: "Personal Training" }],
        copy: { problema: "¿No escalas tu negocio fitness?", sueno: "50 clientes de coaching de alto nivel" }
      },
      editor: {
        nombre: "Editor de Video",
        use_master: false,
        keywords: ["video editing", "premiere", "after effects"],
        edades: [22, 45],
        intereses: [{ id: "123456789", name: "Video Editing" }],
        copy: { problema: "¿Editas mucho y cobras poco?", sueno: "Proyectos de 5,000$ por edición" }
      },
      fintech: {
        nombre: "Inversor / Fintech",
        use_master: false,
        keywords: ["inversiones", "crypto", "trading"],
        edades: [28, 60],
        intereses: [{ id: "6003298262463", name: "Cryptocurrency" }],
        copy: { problema: "¿Inviertes sin retornos?", sueno: "Automatiza tus inversiones con IA" }
      },
      automatizacion: {
        nombre: "Automatización / IA",
        use_master: false,
        keywords: ["automatización", "ia", "chatbot"],
        edades: [24, 50],
        intereses: [{ id: "6003317269464", name: "Online business" }],
        copy: { problema: "¿Sigues haciendo tareas manuales?", sueno: "Negocio funcionando solo 24/7" }
      }
    };
  }

  /**
   * LÓGICA DE OPTIMIZACIÓN IA3
   * Revisa si hay aprendizaje nuevo para inyectar en la segmentación
   */
  obtenerAjustesIA3() {
    try {
      if (fs.existsSync(this.learningPath)) {
        const data = JSON.parse(fs.readFileSync(this.learningPath, 'utf8'));
        sovyxLogger.info('IA1: Memoria de IA3 detectada. Aplicando optimización... 🧠');
        return data.patron;
      }
    } catch (e) {
      sovyxLogger.warn('IA1: Error leyendo memoria de IA3');
    }
    return null;
  }

  generarSegmentacion(nicho, isFirstTime = true) {
    const base = this.nichos[nicho] || this.nichos.fitness_coach;
    const ajusteIA3 = this.obtenerAjustesIA3(); // <--- Aquí ocurre la magia
    
    sovyxLogger.info(`IA1: Procesando segmentación para ${nicho}`);

    // Si hay aprendizaje de la IA3, lo aplicamos a las edades y ciudades
    let targetActual = base.use_master && this.masterTargeting 
      ? JSON.parse(JSON.stringify(this.masterTargeting)) // Clonamos el master
      : {
          age_min: base.edades[0],
          age_max: base.edades[1],
          geo_locations: { countries: ['US', 'ES', 'MX', 'CO'], location_types: ["home"] },
          flexible_specifications: [
            { interests: base.intereses },
            { behaviors: this.premiumFilters.behaviors }
          ],
          exclusions: { interests: this.premiumFilters.exclusions },
          publisher_platforms: ["instagram"],
          device_platforms: ["mobile"]
        };

    // INYECCIÓN DE APRENDIZAJE IA3
    if (ajusteIA3) {
      sovyxLogger.info(`IA1: Ajustando targeting basado en patrón de compradores (Edad: ${ajusteIA3.edad_ideal})`);
      targetActual.age_min = Math.max(18, ajusteIA3.edad_ideal - 3); // Un rango de 3 años abajo
      targetActual.age_max = Math.min(65, ajusteIA3.edad_ideal + 7); // Un rango de 7 años arriba
      
      // Si la IA3 detectó una ciudad ganadora (ej. Miami), la priorizamos
      if (ajusteIA3.top_ciudad) {
        // Podrías añadir lógica aquí para inyectar ciudades específicas en geo_locations
      }
    }

    return {
      status: isFirstTime ? 'PAUSED' : 'ACTIVE',
      name: `SOVYX_${ajusteIA3 ? 'INTEL' : 'AUTO'}_${base.nombre}_${Date.now()}`,
      optimization_goal: "REPLIES",
      billing_event: "IMPRESSIONS",
      targeting: targetActual
    };
  }

  generarCopy(nicho, tipo) {
    const base = this.nichos[nicho] || this.nichos.fitness_coach;
    return base.copy[tipo] || base.copy.problema;
  }
}

module.exports = SOVYXIA1Segmenter;
