// Añade esto donde tengas tus rutas para probar con un GET
const fsPromises = require('fs/promises'); // Usamos un nombre distinto por si ya declaraste 'fs'
const path = require('path');

router.get('/test-imagen', async (req, res) => {
  console.log('🤠 Iniciando cacería de la imagen en Render...');

  // 5 posibles ubicaciones dependiendo de cómo Render compila el proyecto
  const rutasAPrabar = [
    { id: 1, desc: 'Misma carpeta (routes) usando __dirname', ruta: path.join(__dirname, 'sodie-placeholder.jpg') },
    { id: 2, desc: 'Carpeta public subiendo un nivel', ruta: path.join(__dirname, '..', 'public', 'sodie-placeholder.jpg') },
    { id: 3, desc: 'Carpeta routes usando process.cwd()', ruta: path.join(process.cwd(), 'routes', 'sodie-placeholder.jpg') },
    { id: 4, desc: 'Carpeta public usando process.cwd()', ruta: path.join(process.cwd(), 'public', 'sodie-placeholder.jpg') },
    { id: 5, desc: 'Ruta absoluta directa de Render', ruta: path.resolve(__dirname, 'sodie-placeholder.jpg') }
  ];

  const resultados = [];
  let rutaGanadora = null;

  for (const item of rutasAPrabar) {
    try {
      // fs.access solo verifica si existe y tenemos permisos, es más rápido que leerla toda
      await fsPromises.access(item.ruta); 
      resultados.push({ id: item.id, status: '✅ ENCONTRADA', ruta: item.ruta });
      
      // Guardamos la primera que funcione
      if (!rutaGanadora) rutaGanadora = item.ruta;
    } catch (err) {
      resultados.push({ id: item.id, status: '❌ NO EXISTE', ruta: item.ruta });
    }
  }

  return res.json({
    mensaje: rutaGanadora ? '¡Habemus Imagen! 🗿✨' : 'Ninguna ruta funcionó 😩',
    rutaGanadora: rutaGanadora || 'Sigue perdida en el limbo',
    detalles: resultados
  });
});
