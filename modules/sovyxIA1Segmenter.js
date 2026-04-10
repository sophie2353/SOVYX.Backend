const sovyxLogger = require('./sovyxLogger');
const fs = require('fs');
const path = require('path');

class SOVYXIA1Segmenter {
  constructor() {
    this.nichos = this.cargarNichos();
    this.premiumFilters = this.cargarFiltrosElite();
    this.masterTargeting = this.cargarMasterTargeting();
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

  generarSegmentacion(nicho, isFirstTime = true) {
    const base = this.nichos[nicho] || this.nichos.fitness_coach;
    
    sovyxLogger.info(`IA1: Procesando segmentación para ${nicho}`);

    if (base.use_master && this.masterTargeting) {
      sovyxLogger.info(`IA1: Aplicando Patrón Maestro para ${nicho} 👺`);
      return {
        status: isFirstTime ? 'PAUSED' : 'ACTIVE',
        name: `SOVYX_MASTER_${base.nombre}_${Date.now()}`,
        optimization_goal: "REPLIES",
        billing_event: "IMPRESSIONS",
        targeting: this.masterTargeting 
      };
    }

    return {
      status: isFirstTime ? 'PAUSED' : 'ACTIVE',
      name: `SOVYX_AUTO_${base.nombre}_${Date.now()}`,
      optimization_goal: "REPLIES",
      billing_event: "IMPRESSIONS",
      targeting: {
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
      }
    };
  }

  generarCopy(nicho, tipo) {
    const base = this.nichos[nicho] || this.nichos.fitness_coach;
    return base.copy[tipo] || base.copy.problema;
  }
}

module.exports = SOVYXIA1Segmenter;
