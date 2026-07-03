const { CompanySettings } = require('../models');
const logger = require('../config/logger');

/**
 * GET /api/company — público, sin autenticación requerida.
 * Devuelve los datos de configuración de la empresa.
 */
const getSettings = async (req, res) => {
  try {
    const [settings] = await CompanySettings.findOrCreate({
      where: { id: 1 },
      defaults: { name: 'Mi Empresa' },
    });

    return res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Error al obtener configuración de empresa:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * PUT /api/company — requiere settings.manage.
 * Actualiza los datos de la empresa.
 */
const updateSettings = async (req, res) => {
  try {
    const { name, address, phone, email, tax_id, website } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'El nombre de la empresa es obligatorio' });
    }

    const [settings] = await CompanySettings.findOrCreate({
      where: { id: 1 },
      defaults: { name: 'Mi Empresa' },
    });

    await settings.update({ name, address, phone, email, tax_id, website });

    return res.json({ success: true, data: settings, message: 'Configuración guardada correctamente' });
  } catch (error) {
    logger.error('Error al actualizar configuración de empresa:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

module.exports = { getSettings, updateSettings };
