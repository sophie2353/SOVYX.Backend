// Método 1: Guardar tokens y cuentas de Facebook
async guardarCredencialesMeta(email, metaData) {
  return await ClienteModel.findOneAndUpdate(
    { email },
    { $set: { meta: metaData } },
    { new: true }
  );
},

// Método 2: Actualizar la fase del ciclo (24h / 48h / Finalizado)
async actualizarEstadoCiclo(email, nuevoEstado, datosExtra = {}) {
  return await ClienteModel.findOneAndUpdate(
    { email },
    { 
      $set: { 
        'ciclo.estado': nuevoEstado,
        ...datosExtra 
      } 
    },
    { new: true }
  );
}
