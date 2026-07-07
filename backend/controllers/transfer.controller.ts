// Express type imports (ALWAYS at the top)
import { Request, Response, NextFunction } from 'express';

// Sequelize imports (only what is used in the controller)
import { Op } from 'sequelize';

// Model imports (esModuleInterop — require with export = in the .ts files)
import Transfer from '../models/Transfer';
import TransferDetail from '../models/TransferDetail';
import Warehouse from '../models/Warehouse';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import Inventory from '../models/Inventory';
import InventoryMovement from '../models/InventoryMovement';
import User from '../models/User';
import Batch from '../models/Batch';

// Other requires that are not models/sequelize/express → leave as require()
const logger = require('../config/logger');
const { sequelize } = require('../config/database');

const generateTransferNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${dateStr}`;

  const lastTransfer = await Transfer.findOne({
    where: {
      transfer_number: {
        [Op.like]: `${prefix}%`
      }
    },
    order: [['transfer_number', 'DESC']]
  }) as any;

  let sequence = 1;
  if (lastTransfer) {
    const lastSeq = parseInt(lastTransfer.transfer_number.split('-').pop());
    sequence = lastSeq + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

export const createTransfer = async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();

  try {
    logger.info('Received transfer request:', JSON.stringify(req.body, null, 2));
    const { origin_warehouse_id, destination_warehouse_id, notes, items } = req.body;

    if (!origin_warehouse_id || !destination_warehouse_id) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Se requieren almacén de origen y destino'
      });
    }

    if (origin_warehouse_id === destination_warehouse_id) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'El almacén de origen y destino deben ser diferentes'
      });
    }

    if (!items || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Se requiere al menos un producto para transferir'
      });
    }

    const originWarehouse = await Warehouse.findByPk(origin_warehouse_id, { transaction }) as any;
    const destinationWarehouse = await Warehouse.findByPk(destination_warehouse_id, { transaction }) as any;

    if (!originWarehouse || !destinationWarehouse) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Almacén no encontrado'
      });
    }

    const transfer_number = await generateTransferNumber();

    const transferDetails = [];
    const inventoryImpact = [];

    for (const item of items) {
      const { product_id, presentation_id, package_quantity, loose_units, batch_id, notes: itemNotes } = item;

      const product = await Product.findByPk(product_id, { transaction }) as any;
      if (!product) {
        await transaction.rollback();
        return res.status(404).json({
          message: `Producto con ID ${product_id} no encontrado`
        });
      }

      let presentation = null;
      let units_per_package = 1;

      if (presentation_id) {
        presentation = await ProductPresentation.findByPk(presentation_id, { transaction }) as any;
        if (!presentation) {
          await transaction.rollback();
          return res.status(404).json({
            message: `Presentación con ID ${presentation_id} no encontrada`
          });
        }
        units_per_package = presentation.units_per_package;
      }

      const packageUnits = (package_quantity || 0) * units_per_package;
      const totalUnits = packageUnits + parseFloat(loose_units || 0);

      if (totalUnits <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: `La cantidad total debe ser mayor a cero para el producto ${product.name}`
        });
      }

      let inventory = await Inventory.findOne({
        where: {
          product_id,
          warehouse_id: origin_warehouse_id
        },
        lock: transaction.LOCK.UPDATE,
        transaction
      }) as any;

      if (!inventory || inventory.quantity < totalUnits) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Stock insuficiente en almacén de origen para ${product.name}. Disponible: ${inventory?.quantity || 0}, Requerido: ${totalUnits}`
        });
      }

      const oldQuantity = inventory.quantity;
      inventory.quantity = parseFloat(inventory.quantity) - totalUnits;
      await inventory.save({ transaction });

      inventoryImpact.push({
        warehouse_id: origin_warehouse_id,
        product_id,
        product_name: product.name,
        old_quantity: oldQuantity,
        new_quantity: inventory.quantity
      });

      transferDetails.push({
        product_id,
        presentation_id,
        package_quantity: package_quantity || null,
        loose_units: loose_units || 0,
        quantity_requested: totalUnits,
        quantity_shipped: totalUnits,
        quantity_received: 0,
        batch_id,
        notes: itemNotes
      });

      await InventoryMovement.create({
        product_id,
        warehouse_id: origin_warehouse_id,
        presentation_id,
        movement_type: 'transferencia',
        package_quantity: package_quantity || null,
        loose_units: loose_units || 0,
        quantity: -totalUnits,
        document_number: transfer_number,
        reason: `Transferencia a ${destinationWarehouse.name}`,
        batch_id,
        user_id: (req as any).user.id
      } as any, { transaction }) as any;
    }

    const transfer = await Transfer.create({
      transfer_number,
      origin_warehouse_id,
      destination_warehouse_id,
      status: 'pending',
      requested_by: (req as any).user.id,
      transfer_date: new Date(),
      notes
    }, { transaction }) as any;

    for (const detail of transferDetails) {
      await TransferDetail.create({
        transfer_id: transfer.id,
        ...detail
      }, { transaction }) as any;
    }

    await transaction.commit();

    const createdTransfer = await Transfer.findByPk(transfer.id, {
      include: [
        { model: Warehouse, as: 'originWarehouse', attributes: ['id', 'name'] },
        { model: Warehouse, as: 'destinationWarehouse', attributes: ['id', 'name'] },
        { model: User, as: 'requester', attributes: ['id', 'username', 'first_name', 'last_name'] },
        {
          model: TransferDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package'] }
          ]
        }
      ]
    }) as any;

    res.status(201).json({
      message: 'Transferencia creada exitosamente',
      data: {
        transfer: createdTransfer,
        inventory_impact: inventoryImpact
      }
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

export const getTransfers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      origin_warehouse_id,
      destination_warehouse_id,
      search,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_dir = 'DESC'
    } = req.query as Record<string, string>;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (origin_warehouse_id) {
      where.origin_warehouse_id = origin_warehouse_id;
    }

    if (destination_warehouse_id) {
      where.destination_warehouse_id = destination_warehouse_id;
    }

    if (search) {
      where.transfer_number = {
        [Op.like]: `%${search}%`
      };
    }

    if (date_from && date_to) {
      where.transfer_date = {
        [Op.between]: [date_from, date_to]
      };
    } else if (date_from) {
      where.transfer_date = {
        [Op.gte]: date_from
      };
    } else if (date_to) {
      where.transfer_date = {
        [Op.lte]: date_to
      };
    }

    const { count, rows } = await Transfer.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sort_by, sort_dir.toUpperCase()]],
      include: [
        { model: Warehouse, as: 'originWarehouse', attributes: ['id', 'name'] },
        { model: Warehouse, as: 'destinationWarehouse', attributes: ['id', 'name'] },
        { model: User, as: 'requester', attributes: ['id', 'username', 'first_name', 'last_name'] },
        { model: User, as: 'receiver', attributes: ['id', 'username', 'first_name', 'last_name'] },
        {
          model: TransferDetail,
          as: 'details',
          attributes: ['id', 'quantity_requested'],
          include: [
            { model: Product, as: 'product', attributes: ['id', 'name'] }
          ]
        }
      ]
    }) as any;

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    next(error);
  }
};

export const getTransferById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const transfer = await Transfer.findByPk(id, {
      include: [
        { model: Warehouse, as: 'originWarehouse' },
        { model: Warehouse, as: 'destinationWarehouse' },
        { model: User, as: 'requester', attributes: ['id', 'username', 'first_name', 'last_name'] },
        { model: User, as: 'receiver', attributes: ['id', 'username', 'first_name', 'last_name'] },
        {
          model: TransferDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product' },
            { model: ProductPresentation, as: 'presentation' },
            { model: Batch, as: 'batch' }
          ]
        }
      ]
    }) as any;

    if (!transfer) {
      return res.status(404).json({
        message: 'Transferencia no encontrada'
      });
    }

    res.json({
      data: transfer
    });

  } catch (error) {
    next(error);
  }
};

export const receiveTransfer = async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const transfer = await Transfer.findByPk(id, {
      include: [
        { model: Warehouse, as: 'originWarehouse' },
        { model: Warehouse, as: 'destinationWarehouse' },
        {
          model: TransferDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product' },
            { model: ProductPresentation, as: 'presentation' }
          ]
        }
      ],
      transaction
    }) as any;

    if (!transfer) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Transferencia no encontrada'
      });
    }

    if (transfer.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Solo se pueden recibir transferencias pendientes'
      });
    }

    const inventoryImpact = [];

    for (const detail of transfer.details) {
      const totalUnits = detail.quantity_requested;

      let inventory = await Inventory.findOne({
        where: {
          product_id: detail.product_id,
          warehouse_id: transfer.destination_warehouse_id
        },
        transaction
      }) as any;

      if (!inventory) {
        inventory = await Inventory.create({
          product_id: detail.product_id,
          warehouse_id: transfer.destination_warehouse_id,
          quantity: 0
        } as any, { transaction }) as any;
      }

      const oldQuantity = inventory.quantity;
      inventory.quantity = parseFloat(inventory.quantity) + totalUnits;
      await inventory.save({ transaction });

      inventoryImpact.push({
        warehouse_id: transfer.destination_warehouse_id,
        product_id: detail.product_id,
        product_name: detail.product.name,
        old_quantity: oldQuantity,
        new_quantity: inventory.quantity
      });

      await InventoryMovement.create({
        product_id: detail.product_id,
        warehouse_id: transfer.destination_warehouse_id,
        presentation_id: detail.presentation_id,
        movement_type: 'transferencia',
        package_quantity: detail.package_quantity,
        loose_units: detail.loose_units,
        quantity: totalUnits,
        document_number: transfer.transfer_number,
        reason: `Transferencia desde ${transfer.originWarehouse.name}`,
        batch_id: detail.batch_id,
        user_id: (req as any).user.id
      } as any, { transaction }) as any;

      detail.quantity_received = totalUnits;
      await detail.save({ transaction });
    }

    transfer.status = 'completed';
    transfer.received_by = (req as any).user.id;
    transfer.received_date = new Date();
    await transfer.save({ transaction });

    await transaction.commit();

    const updatedTransfer = await Transfer.findByPk(transfer.id, {
      include: [
        { model: Warehouse, as: 'originWarehouse', attributes: ['id', 'name'] },
        { model: Warehouse, as: 'destinationWarehouse', attributes: ['id', 'name'] },
        { model: User, as: 'requester', attributes: ['id', 'username', 'first_name', 'last_name'] },
        { model: User, as: 'receiver', attributes: ['id', 'username', 'first_name', 'last_name'] },
        {
          model: TransferDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package'] }
          ]
        }
      ]
    }) as any;

    res.json({
      message: 'Transferencia recibida exitosamente',
      data: {
        transfer: updatedTransfer,
        inventory_impact: inventoryImpact
      }
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

export const cancelTransfer = async (req: Request, res: Response, next: NextFunction) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const transfer = await Transfer.findByPk(id, {
      include: [
        { model: Warehouse, as: 'originWarehouse' },
        { model: Warehouse, as: 'destinationWarehouse' },
        {
          model: TransferDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product' }
          ]
        }
      ],
      transaction
    }) as any;

    if (!transfer) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Transferencia no encontrada'
      });
    }

    if (transfer.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Solo se pueden cancelar transferencias pendientes'
      });
    }

    const inventoryImpact = [];

    for (const detail of transfer.details) {
      const totalUnits = detail.quantity_requested;

      let inventory = await Inventory.findOne({
        where: {
          product_id: detail.product_id,
          warehouse_id: transfer.origin_warehouse_id
        },
        transaction
      }) as any;

      if (!inventory) {
        inventory = await Inventory.create({
          product_id: detail.product_id,
          warehouse_id: transfer.origin_warehouse_id,
          quantity: 0
        } as any, { transaction }) as any;
      }

      const oldQuantity = inventory.quantity;
      inventory.quantity = parseFloat(inventory.quantity) + totalUnits;
      await inventory.save({ transaction });

      inventoryImpact.push({
        warehouse_id: transfer.origin_warehouse_id,
        product_id: detail.product_id,
        product_name: detail.product.name,
        old_quantity: oldQuantity,
        new_quantity: inventory.quantity
      });

      await InventoryMovement.create({
        product_id: detail.product_id,
        warehouse_id: transfer.origin_warehouse_id,
        presentation_id: detail.presentation_id,
        movement_type: 'ajuste_positivo',
        package_quantity: detail.package_quantity,
        loose_units: detail.loose_units,
        quantity: totalUnits,
        document_number: transfer.transfer_number,
        reason: reason || `Cancelación de transferencia ${transfer.transfer_number}`,
        batch_id: detail.batch_id,
        user_id: (req as any).user.id
      } as any, { transaction }) as any;
    }

    transfer.status = 'cancelled';
    await transfer.save({ transaction });

    await transaction.commit();

    const updatedTransfer = await Transfer.findByPk(transfer.id, {
      include: [
        { model: Warehouse, as: 'originWarehouse', attributes: ['id', 'name'] },
        { model: Warehouse, as: 'destinationWarehouse', attributes: ['id', 'name'] },
        { model: User, as: 'requester', attributes: ['id', 'username', 'first_name', 'last_name'] },
        {
          model: TransferDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package'] }
          ]
        }
      ]
    }) as any;

    res.json({
      message: 'Transferencia cancelada exitosamente',
      data: {
        transfer: updatedTransfer,
        inventory_impact: inventoryImpact
      }
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};