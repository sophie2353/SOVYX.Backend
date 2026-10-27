// middleware/translator.js (Middleware global)
const dict = {
    en: { success: "Campaign draft created successfully", error: "Missing data" },
    pt: { success: "Rascunho da campanha criado com sucesso", error: "Dados em falta" }
};

module.exports = (req, res, next) => {
    const lang = req.headers['accept-language'] || 'en'; // Detecta el idioma
    req.t = (key) => dict[lang][key] || dict['en'][key]; // Función de traducción rápida
    next();
};
