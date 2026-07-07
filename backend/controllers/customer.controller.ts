import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import Customer from '../models/Customer';
import PriceList from '../models/PriceList';
import Sale from '../models/Sale';
import SalePayment from '../models/SalePayment';

const { sequelize } = require('../config/database');
const {
  getCustomerStats,
  getOverdueCustomers,
  getCustomerStatement,
  getCustomerCreditBalance,
  getCustomerPurchases,
  getCustomerActivity
} = require('../services/customer.service');

class CustomerController {
  constructor() {
    this.getAllCustomers = this.getAllCustomers.bind(this);
    this.getActiveCustomers = this.getActiveCustomers.bind(this);
  }

  // Get all customers with filters
  async getAllCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        pageStr = '1', limitStr = '50', search, status, type, is_active,
        sort_by = 'created_at', sort_dir = 'DESC'
      } = req.query as Record<string, string>;

      if (is_active === 'true') return this.getActiveCustomers(req, res, next);

      const page = parseInt(pageStr, 10);
      const limit = parseInt(limitStr, 10);
      const offset = (page - 1) * limit;
      const where: any = {};

      if (search) {
        where[Op.or] = [
          { code: { [Op.like]: `%${search}%` } },
          { business_name: { [Op.like]: `%${search}%` } },
          { trade_name: { [Op.like]: `%${search}%` } },
          { first_name: { [Op.like]: `%${search}%` } },
          { last_name: { [Op.like]: `%${search}%` } },
          { document_number: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
      }
      if (status) where.status = status;
      if (type) where.type = type;

      const { rows: customers, count } = await Customer.findAndCountAll({
        where,
        include: [{ model: PriceList, as: 'priceList', attributes: ['id', 'code', 'name', 'currency'] }],
        limit, offset,
        order: [[sort_by, sort_dir.toUpperCase()] as [string, string]]
      }) as any;

      res.json({
        data: customers,
        pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get active customers (for dropdowns)
  async getActiveCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const customers = await Customer.findAll({
        where: { status: 'active' },
        attributes: ['id', 'code', 'first_name', 'last_name', 'business_name', 'trade_name', 'type', 'credit_limit', 'discount_percentage', 'price_list_id'],
        order: [['code', 'ASC']],
        limit: 500
      }) as any[];

      const customersWithName = customers.map((c: any) => ({ ...c.toJSON(), fullName: c.getFullName() }));
      res.json({ data: customersWithName });
    } catch (error) {
      next(error);
    }
  }

  // Get customer by ID
  async getCustomerById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await Customer.findOne({
        where: { id },
        include: [{ model: PriceList, as: 'priceList', attributes: ['id', 'code', 'name', 'currency', 'base_percentage'] }]
      }) as any;

      if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });
      res.json({ data: { ...customer.toJSON(), fullName: customer.getFullName() } });
    } catch (error) {
      next(error);
    }
  }

  // Create customer
  async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        type, document_type, document_number, business_name, trade_name, first_name, last_name,
        email, phone, mobile, address, city, state, country, postal_code,
        credit_limit, credit_days, price_list_id, discount_percentage, notes
      } = req.body;

      if (type === 'juridical' && !business_name) {
        return res.status(400).json({ message: 'La razón social es obligatoria para personas jurídicas' });
      }
      if (type === 'natural' && (!first_name || !last_name)) {
        return res.status(400).json({ message: 'El nombre y apellido son obligatorios para personas naturales' });
      }

      const existingCustomer = await Customer.findOne({ where: { document_number } }) as any;
      if (existingCustomer) {
        return res.status(400).json({ message: `Ya existe un cliente con el documento ${document_number}` });
      }

      const customer = await Customer.create({
        type, document_type, document_number, business_name, trade_name, first_name, last_name,
        email, phone, mobile, address, city, state, country: country || 'Venezuela', postal_code,
        credit_limit: credit_limit || 0, credit_days: credit_days || 0, price_list_id,
        discount_percentage: discount_percentage || 0, notes, status: 'active'
      } as any) as any;

      await customer.reload({
        include: [{ model: PriceList, as: 'priceList', attributes: ['id', 'code', 'name', 'currency'] }]
      });

      res.status(201).json({
        message: 'Cliente creado exitosamente',
        data: { ...customer.toJSON(), fullName: customer.getFullName() }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update customer
  async updateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      delete updateData.code;

      const customer = await Customer.findOne({ where: { id } }) as any;
      if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

      if (updateData.type === 'juridical' && !updateData.business_name && !customer.business_name) {
        return res.status(400).json({ message: 'La razón social es obligatoria para personas jurídicas' });
      }
      if (updateData.type === 'natural' &&
        ((!updateData.first_name && !customer.first_name) || (!updateData.last_name && !customer.last_name))) {
        return res.status(400).json({ message: 'El nombre y apellido son obligatorios para personas naturales' });
      }

      if (updateData.document_number && updateData.document_number !== customer.document_number) {
        const existing = await Customer.findOne({
          where: { document_number: updateData.document_number, id: { [Op.ne]: id } }
        }) as any;
        if (existing) {
          return res.status(400).json({ message: `Ya existe un cliente con el documento ${updateData.document_number}` });
        }
      }

      await customer.update(updateData);
      await customer.reload({
        include: [{ model: PriceList, as: 'priceList', attributes: ['id', 'code', 'name', 'currency'] }]
      });

      res.json({ message: 'Cliente actualizado exitosamente', data: { ...customer.toJSON(), fullName: customer.getFullName() } });
    } catch (error) {
      next(error);
    }
  }

  // Delete customer (soft delete via paranoid)
  async deleteCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await Customer.findByPk(id) as any;
      if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

      const salesCount = await Sale.count({ where: { customer_id: id } });
      await customer.destroy();

      const message = salesCount > 0
        ? 'Cliente desactivado exitosamente (tiene ventas asociadas)'
        : 'Cliente eliminado exitosamente';
      res.json({ message });
    } catch (error) {
      next(error);
    }
  }

  // Validate credit availability
  async validateCredit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { amount } = req.query as Record<string, string>;

      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: 'El monto es requerido para validar el crédito' });
      }

      const customer = await Customer.findByPk(id) as any;
      if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

      const creditLimit = parseFloat(customer.credit_limit || 0);
      const creditUsed = parseFloat(customer.credit_used || 0);
      const requestedAmount = parseFloat(amount);
      const hasLimit = creditLimit > 0;
      const availableCredit = hasLimit ? Math.max(0, creditLimit - creditUsed) : Infinity;
      const hasAvailableCredit = !hasLimit || (creditUsed + requestedAmount) <= creditLimit;

      res.json({
        data: {
          customerId: id, customerName: customer.getFullName(), creditLimit,
          currentBalance: creditUsed, availableCredit: hasLimit ? availableCredit : null,
          requestedAmount, hasAvailableCredit,
          creditStatus: hasAvailableCredit ? 'approved' : 'rejected'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get credit summary
  async getCreditSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await Customer.findByPk(id) as any;
      if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

      const creditLimit = parseFloat(customer.credit_limit || 0);
      const creditUsed = parseFloat(customer.credit_used || 0);
      const availableCredit = Math.max(0, creditLimit - creditUsed);
      const creditUsagePercent = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

      const pendingSales = await Sale.findAll({
        where: {
          customer_id: id,
          sale_type: 'credit',
          payment_status: { [Op.in]: ['pending', 'partial'] }
        } as any,
        attributes: ['id', 'sale_number', 'sale_date', 'total', 'payment_status'],
        include: [{ model: SalePayment, as: 'payments', attributes: ['amount', 'payment_date'] }],
        order: [['sale_date', 'DESC']],
        limit: 10
      }) as any[];

      res.json({
        data: {
          customer: { id: customer.id, code: customer.code, name: customer.getFullName(), creditLimit, creditDays: customer.credit_days },
          credit: { limit: creditLimit, used: creditUsed, available: availableCredit, usagePercent: parseFloat(creditUsagePercent.toFixed(2)) },
          pendingSales: pendingSales.map((s: any) => {
            const paid = (s.payments || []).reduce((sum: any, p: any) => sum + parseFloat(p.amount), 0);
            return {
              id: s.id, sale_number: s.sale_number, sale_date: s.sale_date,
              total: parseFloat(s.total), paid, balance: parseFloat(s.total) - paid,
              payment_status: s.payment_status
            };
          })
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── Analytics (delegated to customer.service) ─────────────────────────────

  async getCustomerStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await getCustomerStats(req.params.id);
      if (!data) return res.status(404).json({ message: 'Cliente no encontrado' });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }

  async getOverdueCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await getOverdueCustomers();
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }

  async getStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getCustomerStatement(req.params.id);
      if (!result) return res.status(404).json({ message: 'Cliente no encontrado' });
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getCreditBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getCustomerCreditBalance(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getCustomerPurchases(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { date_from, date_to } = req.query as Record<string, string>;

      const customer = await Customer.findByPk(id, { attributes: ['id'] }) as any;
      if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

      const now = new Date();
      const dateFrom = date_from ? new Date(date_from) : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const dateTo = date_to ? new Date(date_to) : now;

      const data = await getCustomerPurchases(id, dateFrom, dateTo);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }

  async getCustomerActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { days = '90', min_purchases = '1' } = req.query as Record<string, string>;
      const data = await getCustomerActivity(parseInt(days), parseInt(min_purchases));
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }
}

export = new CustomerController();
