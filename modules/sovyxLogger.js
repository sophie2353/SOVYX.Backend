// modules/sovyxLogger.js
class SOVYXLogger {
  info(message, data = {}) {
    console.log(`📘 ${new Date().toISOString()} - ${message}`, 
      Object.keys(data).length ? JSON.stringify(data) : '');
  }
  
  warn(message, data = {}) {
    console.warn(`⚠️ ${new Date().toISOString()} - ${message}`, 
      Object.keys(data).length ? JSON.stringify(data) : '');
  }
  
  error(message, data = {}) {
    console.error(`❌ ${new Date().toISOString()} - ${message}`, 
      Object.keys(data).length ? JSON.stringify(data) : '');
  }
  
  success(message, data = {}) {
    console.log(`✅ ${new Date().toISOString()} - ${message}`, 
      Object.keys(data).length ? JSON.stringify(data) : '');
  }
}

module.exports = new SOVYXLogger();
