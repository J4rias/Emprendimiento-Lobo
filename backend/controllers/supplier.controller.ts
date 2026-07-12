import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import Supplier from '../models/Supplier';
import SupplierContact from '../models/SupplierContact';

const logger = require('../config/logger');
const { sequelize } = require('../config/database');
const { getSupplierLedger, getSupplierResumen } = require('../services/supplier.service');

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page: pageStr = '1', limit: limitStr = '20', search = '', sort_by = 'name', sort_dir = 'ASC', is_active } = req.query as Record<string, string>;

    if (is_active === 'true') {
      return getActive(req, res, next);
    }
    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);
    const offset = (page - 1) * limit;

    const { count, rows: suppliers } = await Supplier.findAndCountAll({
      where: search ? {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { tax_id: { [Op.like]: `%${search}%` } }
        ]
      } : {},
      order: [[sort_by, sort_dir.toUpperCase()] as [string, string]],
      limit,
      offset,
      include: [{ model: SupplierContact, as: 'contacts', where: { is_active: true }, required: false }]
    }) as any;

    res.json({
      data: suppliers,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
    });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id, {
      include: [{ model: SupplierContact, as: 'contacts', where: { is_active: true }, required: false }]
    }) as any;

    if (!supplier) return res.status(404).json({ message: 'Proveedor no encontrado' });
    res.json({ data: supplier });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const { contacts, ...supplierData } = req.body;

    if (supplierData.name || supplierData.tax_id) {
      const orConditions = [];
      if (supplierData.name) orConditions.push({ name: supplierData.name });
      if (supplierData.tax_id) orConditions.push({ tax_id: supplierData.tax_id });
      const existing = await Supplier.findOne({ where: { [Op.or]: orConditions } }) as any;
      if (existing) {
        await transaction.rollback();
        return res.status(409).json({ message: 'Ya existe un proveedor con ese nombre o RIF' });
      }
    }

    const supplier = await Supplier.create({
      ...supplierData, created_by: (req as any).user.id
    }, { transaction }) as any;

    if (contacts && contacts.length > 0) {
      const hasPrimary = contacts.some((c: any) => c.is_primary);
      const contactsToCreate = contacts.map((contact: any, index: any) => ({
        ...contact,
        supplier_id: supplier.id,
        is_primary: index === 0 && !hasPrimary ? true : contact.is_primary,
        created_by: (req as any).user.id
      }));
      await SupplierContact.bulkCreate(contactsToCreate, { transaction });
    }

    await transaction.commit();

    const supplierWithContacts = await Supplier.findByPk(supplier.id, {
      include: [{ model: SupplierContact, as: 'contacts', where: { is_active: true }, required: false }]
    }) as any;

    res.status(201).json({ message: 'Proveedor creado exitosamente', data: supplierWithContacts });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { contacts, ...supplierData } = req.body;

    logger.info('Update supplier - req.body:', req.body);
    logger.info('Update supplier - supplierData:', supplierData);
    logger.info('Update supplier - contacts:', contacts);

    const supplier = await Supplier.findByPk(id, { transaction }) as any;
    if (!supplier) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    await supplier.update({ ...supplierData, updated_by: (req as any).user.id }, { transaction });

    if (contacts) {
      const existingContacts = await SupplierContact.findAll({ where: { supplier_id: id }, transaction }) as any[];
      const existingContactIds = existingContacts.map((c: any) => c.id);
      const newContactIds = contacts.filter((c: any) => c.id).map((c: any) => c.id);

      const hasPrimary = contacts.some((c: any) => c.is_primary);
      const processedContacts = contacts.map((contact: any, index: any) => ({
        ...contact, is_primary: index === 0 && !hasPrimary ? true : contact.is_primary
      }));

      const newContacts = processedContacts.filter((c: any) => !c.id);
      const updatedContacts = processedContacts.filter((c: any) => c.id);

      if (newContacts.length > 0) {
        await SupplierContact.bulkCreate(
          newContacts.map((contact: any) => ({
            ...contact, supplier_id: id, created_by: (req as any).user.id
          })),
          { transaction }
        );
      }

      for (const contact of updatedContacts) {
        await SupplierContact.update(
          { ...contact, updated_by: (req as any).user.id },
          { where: { id: contact.id, supplier_id: id }, transaction }
        );
      }

      const contactsToDelete = existingContactIds.filter(
        (cid: any) => !newContactIds.includes(cid)
      );
      if (contactsToDelete.length > 0) {
        await SupplierContact.update(
          { is_active: false, updated_by: (req as any).user.id },
          { where: { id: contactsToDelete, supplier_id: id }, transaction }
        );
      }
    }

    await transaction.commit();

    const supplierWithContacts = await Supplier.findByPk(id, {
      include: [{ model: SupplierContact, as: 'contacts', where: { is_active: true }, required: false }]
    }) as any;

    res.json({ message: 'Proveedor actualizado exitosamente', data: supplierWithContacts });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id) as any;
    if (!supplier) return res.status(404).json({ message: 'Proveedor no encontrado' });
    // Soft-delete: el proveedor puede tener OCs y pagos históricos asociados
    await supplier.update({ is_active: false, updated_by: (req as any).user.id });
    res.json({ message: 'Proveedor desactivado exitosamente' });
  } catch (error) {
    next(error);
  }
};

export const getActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suppliers = await Supplier.findAll({
      where: { is_active: true }, order: [['name', 'ASC']], attributes: ['id', 'name']
    }) as any[];
    res.json({ data: suppliers });
  } catch (error) {
    next(error);
  }
};

// ─── Analytics (delegated to supplier.service) ───────────────────────────────

export const getLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getSupplierLedger(req.params.id);
    if (!result) return res.status(404).json({ message: 'Proveedor no encontrado' });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getResumen = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getSupplierResumen();
    res.json({ data });
  } catch (error) {
    next(error);
  }
};
