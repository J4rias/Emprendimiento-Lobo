// Imports de tipos Express (SIEMPRE al principio)
import { Request, Response } from 'express';

// Imports de modelos (esModuleInterop — require con export = en los .ts)
import CompanySettings from '../models/CompanySettings';

// Otros requires que no sean modelos/sequelize/express → dejar como require()
const logger = require('../config/logger');

/**
 * GET /api/company — público, sin autenticación requerida.
 * Devuelve los datos de configuración de la empresa.
 */
export const getSettings = async (req: Request, res: Response) => {
  try {
    const [settings] = await CompanySettings.findOrCreate({
      where: { id: 1 },
      defaults: { name: 'Mi Empresa' },
    });

    return res.json({ data: settings });
  } catch (error) {
    logger.error('Error al obtener configuración de empresa:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * PUT /api/company — requiere settings.manage.
 * Actualiza los datos de la empresa.
 */
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { name, address, phone, email, tax_id, website } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'El nombre de la empresa es obligatorio' });
    }

    const [settings] = await CompanySettings.findOrCreate({
      where: { id: 1 },
      defaults: { name: 'Mi Empresa' },
    });

    await settings.update({ name, address, phone, email, tax_id, website });

    return res.json({ data: settings, message: 'Configuración guardada correctamente' });
  } catch (error) {
    logger.error('Error al actualizar configuración de empresa:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};