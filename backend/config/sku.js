const crypto = require('crypto');

/**
 * SKU Configuration
 * Format: {BRAND_3_LETRAS}-{NOMBRE_CORTO}-{CONTENIDO}-{UOM}-{HASH4}
 * Example: POR-ACEITE-SOYA-850-ML-7F3A
 */

// Palabras de ruido a eliminar
const NOISE_WORDS = [
  'DE', 'LA', 'EL', 'LOS', 'LAS', 'UN', 'UNA', 'Y', 'CON', 'EN', 'PARA',
  'POR', 'SIN', 'TIPO', 'MARCA', 'PRODUCTO', 'ALIMENTO', 'BEBIDA'
];

module.exports = {
  format: '{BRAND_3_LETRAS}-{NOMBRE_CORTO}-{CONTENIDO}-{UOM}-{HASH4}',

  /**
   * Normaliza texto: mayúsculas, sin tildes, sin ñ
   */
  normalize: function(text) {
    if (!text) return '';

    return text
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/Ñ/g, 'N')
      .trim();
  },

  /**
   * Limpia y acorta un texto removiendo palabras de ruido
   */
  cleanText: function(text) {
    if (!text) return '';

    const normalized = this.normalize(text);
    // Eliminar números, comas y unidades de medida comunes
    // Las unidades más largas van primero para evitar matches parciales (LT antes que L)
    const withoutMetrics = normalized
      .replace(/\d+\s*(UNIDADES|UNIDAD|BOTELLAS|BOTELLA|PAQUETE|CAJA|BOLSA|ML|LT|KG|GR|OZ|UND|L)/gi, '')
      .replace(/[0-9,+*/<>=!]/g, '') // Eliminar números, comas y caracteres especiales
      .trim();
    const words = withoutMetrics.split(/[\s\-\_\.]+/);

    // Filtrar palabras de ruido
    const cleanWords = words.filter(word => {
      return word.length > 0 && !NOISE_WORDS.includes(word);
    });

    return cleanWords.join('-');
  },

  /**
   * Extrae código de marca (primeras 3 letras)
   */
  getBrandCode: function(brandName) {
    if (!brandName) return 'GEN'; // Generic

    const normalized = this.normalize(brandName);
    const letters = normalized.replace(/[^A-Z]/g, '');

    if (letters.length >= 3) {
      return letters.substring(0, 3);
    } else if (letters.length > 0) {
      return (letters + 'XXX').substring(0, 3);
    }

    return 'GEN';
  },

  /**
   * Extrae nombre corto del producto (2-3 letras por palabra)
   * Ejemplo: ACEITE-COMESTIBLE-SOYA → ACE-COM-SOY
   * Nota: Limita a 2-3 palabras para evitar redundancia con la marca
   */
  getShortName: function(productName) {
    if (!productName) return 'PRO';

    const cleaned = this.cleanText(productName);
    const parts = cleaned.split('-');

    // Tomar las primeras 2-3 palabras significativas y abreviarlas
    // (3 como máximo para evitar redundancia con marca)
    const significantParts = parts.slice(0, 3);

    const abbreviated = significantParts.map(word => {
      if (word.length <= 3) return word;
      // Tomar primeras 3 letras o primeras 2 si es muy corto
      return word.length >= 4 ? word.substring(0, 3) : word.substring(0, 2);
    });

    return abbreviated.join('-');
  },

  /**
   * Extrae información del producto (unit_size y unit_size_measure)
   */
  getProductInfo: function(unit_size, unit_size_measure) {
    let content = unit_size || '1';
    const uom = unit_size_measure || 'UND';

    // Limpiar y formatear el contenido
    content = String(content).replace(/[^0-9.]/g, '');

    // Remover decimales innecesarios (.00)
    const num = parseFloat(content);
    if (!isNaN(num)) {
      content = num % 1 === 0 ? String(Math.floor(num)) : String(num);
    }

    return {
      content: content,
      uom: this.normalize(uom)
    };
  },

  /**
   * Genera hash MD5 de 4 caracteres hexadecimales
   * El hash es inmutable y se preserva aunque cambien otros datos
   */
  generateHash: function(brand_id, productName, content, uom, existingSku = null) {
    // Si ya existe SKU y tiene hash válido, preservarlo (inmutabilidad)
    if (existingSku && existingSku.length > 4) {
      const parts = existingSku.split('-');
      const lastPart = parts[parts.length - 1];
      // Verificar que sea un hash válido (4 caracteres hexadecimales)
      if (lastPart && lastPart.length === 4 && lastPart.match(/^[0-9A-F]{4}$/)) {
        return lastPart;
      }
    }

    // Generar nuevo hash MD5 basado en campos clave
    // Usar timestamp para mayor entropía si no hay existingSku
    const timestamp = existingSku ? '' : Date.now();
    const data = `${brand_id || 'NULL'}-${productName}-${content}-${uom}-${timestamp}`;
    const hash = crypto.createHash('md5').update(data).digest('hex');

    return hash.substring(0, 4).toUpperCase();
  },

  /**
   * Elimina referencias a la marca del nombre corto para evitar redundancia
   * Ej: shortName="ACE-VEG-VAT", brandCode="VAT" → "ACE-VEG"
   */
  removeRedundantBrand: function(shortName, brandCode) {
    if (!shortName || !brandCode) return shortName;

    const parts = shortName.split('-');
    // Eliminar cualquier parte que coincida con el código de marca
    const filtered = parts.filter(part => part !== brandCode);

    // Si quedan partes, unirlas; si no, devolver al menos 2 caracteres
    return filtered.length > 0 ? filtered.join('-') : shortName.substring(0, 2);
  },

  /**
   * Genera SKU completo
   * @param {Object} options - { brandName, productName, unit_size, unit_size_measure, brand_id, existingSku }
   */
  generate: function(options) {
    const {
      brandName,
      productName,
      unit_size,
      unit_size_measure,
      brand_id = null,
      existingSku = null
    } = options;

    // Extraer componentes
    const brandCode = this.getBrandCode(brandName);
    let shortName = this.getShortName(productName);
    // OPCIÓN B: Eliminar marca redundante del shortName
    shortName = this.removeRedundantBrand(shortName, brandCode);

    const { content, uom } = this.getProductInfo(unit_size, unit_size_measure);
    const hash = this.generateHash(brand_id, productName, content, uom, existingSku);

    // Construir SKU
    const skuParts = [
      brandCode,
      shortName,
      content,
      uom,
      hash
    ].filter(part => part && part.length > 0);

    return skuParts.join('-');
  },

  /**
   * Valida formato de SKU
   */
  validate: function(sku) {
    if (!sku) return false;

    const parts = sku.split('-');
    if (parts.length < 4) return false;

    // Verificar que el último componente sea el hash (4 hex chars)
    const lastPart = parts[parts.length - 1];
    return lastPart.match(/^[0-9A-F]{4}$/) !== null;
  }
};
