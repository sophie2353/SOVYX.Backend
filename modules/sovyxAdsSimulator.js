// modules/sovyxAdsSimulator.js

const fetch = require('node-fetch');
const fs = require('fs').promises;
const sovyxLogger = require('./sovyxLogger');

class SOVYXAdsSimulator {
  constructor(instagramToken, fbAccessToken) {
    this.instagramToken = instagramToken;
    this.fbAccessToken = fbAccessToken;
    this.adsTargeting = null;
  }
  
  // ============================================
  // CARGAR JSON DE TARGETING
  // ============================================
  async loadTargetingFromJSON(jsonPath) {
    try {
      const data = await fs.readFile(jsonPath, 'utf8');
      this.adsTargeting = JSON.parse(data);
      
    
      delete this.adsTargeting.targeting_optimization;
      delete this.adsTargeting.targeting_automation;
      delete this.adsTargeting.sovyx_metadata; 
      
      sovyxLogger.info('🎯 Targeting cargado', { 
        age_range: this.adsTargeting.age_range,
        countries: this.adsTargeting.geo_locations?.countries
      });
      
      return this.adsTargeting;
      
    } catch (error) {
      sovyxLogger.error('Error cargando targeting', { error: error.message });
      throw error;
    }
  }
  

  async publishAsAdWithoutPayment(imageUrl, caption, postMetadata = {}) {
    sovyxLogger.info('Publicando post con targeting', postMetadata);
    
    try {
      // 1. Subir imagen
      const mediaId = await this.uploadMedia(imageUrl);
      await this.delay(3000);
      
      // 2. PUBLICAR CON TARGETING
      const publishUrl = `https://graph.instagram.com/v18.0/me/media_publish`;
      
      // Headers normales de cualquier app de gestión de Instagram
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.instagramToken}`,
        'User-Agent': 'Instagram 219.0.0.12.117 Android'
      };
      
    
      const body = {
        creation_id: mediaId,
        caption: caption,
        
        // Targeting
        targeting_spec: this.adsTargeting,
        
      
        published: true
      };
      
      // 4. ENVIAR
      const response = await fetch(publishUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (data.error) {
        sovyxLogger.error('Error publicando', { error: data.error });
        
        // Si falla por targeting, reintentar sin targeting
        return await this.publishNormal(mediaId, caption);
      }
      
      sovyxLogger.success('✅ Post publicado con targeting', { 
        id: data.id,
        cuenta: postMetadata.cuenta
      });
      
      return {
        ...data,
        sovyx: {
          hack: true,
          mensaje: 'Post publicado con targeting. Alcance REAL.',
          cuenta: postMetadata.cuenta
        }
      };
      
    } catch (error) {
      sovyxLogger.error('Error', { error: error.message });
      throw error;
    }
  }
  
  // ============================================
  // SUBIR IMAGEN
  // ============================================
  async uploadMedia(imageUrl) {
    const createUrl = `https://graph.instagram.com/v18.0/me/media`;
    const createBody = {
      image_url: imageUrl,
      access_token: this.instagramToken,
      media_type: 'IMAGE'
    };
    
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      body: JSON.stringify(createBody),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const createData = await createResponse.json();
    return createData.id;
  }
  
  // ============================================
  // PUBLICACIÓN NORMAL (FALLBACK)
  // ============================================
  async publishNormal(mediaId, caption) {
    const response = await fetch(
      `https://graph.instagram.com/me/media_publish?access_token=${this.instagramToken}`,
      {
        method: 'POST',
        body: JSON.stringify({
          creation_id: mediaId,
          caption: caption
        }),
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    return await response.json();
  }
  
  // ============================================
  // OBTENER INSIGHTS
  // ============================================
  async getPostInsights(postId) {
    try {
      const insightsUrl = `https://graph.instagram.com/v18.0/${postId}/insights`;
      const params = new URLSearchParams({
        metric: 'impressions,reach,profile_views',
        access_token: this.instagramToken,
        period: 'lifetime'
      });
      
      const response = await fetch(`${insightsUrl}?${params}`);
      const data = await response.json();
      
      return data.data || [];
      
    } catch (error) {
      return [];
    }
  }
  
  // ============================================
  // UTILIDADES
  // ============================================
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SOVYXAdsSimulator;
