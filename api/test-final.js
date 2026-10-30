const express = require('express');
const router = express.Router();
const fsPromises = require('fs/promises');
const path = require('path');

// Responde tanto a la raíz del router como a la ruta explícita por si tienes prefijos en tu index.js
router.get(['/', '/test-final', '/api/test-final', 'api/admin/test-final'], async (req, res) => {
const BASE = process.cwd(); // En Render esto es: /opt/render/project/src
console.log('🤠 Iniciando cacería de la imagen desde /api/test-final...');
  
  // 15 variaciones brutales (rutas, guiones, mayúsculas, extensiones)
  const rutasAPrabar = [
    // La lógica pura
    path.join(BASE, 'sodie-placeholder.jpg'), 
    path.join(BASE, 'api', 'sodie-placeholder.jpg'),
    path.join(BASE, 'routes', 'sodie-placeholder.jpg'),
    path.join(BASE, 'public', 'sodie-placeholder.jpg'),
    path.join(__dirname, 'sodie-placeholder.jpg'), // Donde sea que esté este test
    
    // Variación: Guion bajo
    path.join(BASE, 'sodie_placeholder.jpg'),
    path.join(BASE, 'routes', 'sodie_placeholder.jpg'),
    path.join(BASE, 'public', 'sodie_placeholder.jpg'),
    
    // Variación: Extensión .jpeg
    path.join(BASE, 'sodie-placeholder.jpeg'),
    path.join(BASE, 'routes', 'sodie-placeholder.jpeg'),
    path.join(BASE, 'public', 'sodie-placeholder.jpeg'),

    // Variación: Mayúsculas
    path.join(BASE, 'sodie-placeholder.JPG'),
    path.join(BASE, 'routes', 'sodie-placeholder.JPG'),
    path.join(BASE, 'public', 'sodie-placeholder.JPG')
  ];

  const resultados = [];
  let rutaGanadora = null;

  for (let i = 0; i < rutasAPrabar.length; i++) {
    const ruta = rutasAPrabar[i];
    try {
      await fsPromises.access(ruta); 
      resultados.push({ id: i + 1, status: '✅ ENCONTRADA', ruta });
      if (!rutaGanadora) rutaGanadora = ruta;
    } catch (err) {
      resultados.push({ id: i + 1, status: '❌ NO', ruta });
    }
  }

  // 🕵️ TRUCO MAESTRO: Si no la encontramos, leemos el disco duro a la fuerza
  let archivosRaiz = [];
  let archivosRoutes = [];
  let archivosPublic = [];
  let archivosApi = [];
  
  try { archivosRaiz = await fsPromises.readdir(BASE); } catch (e) {}
  try { archivosRoutes = await fsPromises.readdir(path.join(BASE, 'routes')); } catch (e) {}
  try { archivosPublic = await fsPromises.readdir(path.join(BASE, 'public')); } catch (e) {}
  try { archivosApi = await fsPromises.readdir(path.join(BASE, 'api')); } catch (e) {}

  return res.json({
    mensaje: rutaGanadora ? '¡APARECIÓ LA BENDITA IMAGEN! 🗿✨' : 'Seguimos ciegos 💀. Revisa abajo los archivos reales que Render ve:',
    rutaGanadora: rutaGanadora || 'N/A',
    detalles: resultados,
    ARCHIVOS_REALES_EN_EL_SERVIDOR: {
      carpeta_raiz: archivosRaiz,
      carpeta_routes: archivosRoutes,
      carpeta_public: archivosPublic,
      carpeta_api: archivosApi
    }
  });
});

module.exports = router;     
