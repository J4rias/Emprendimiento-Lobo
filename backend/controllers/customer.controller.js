const { Customer, PriceList, Sale, SalePayment } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

class CustomerController {
  // Get all customers with filters
  async getAllCustomers(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        status,
        type,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;
      const where = { isDeleted: false };

      // Search filter
      if (search) {
        where[Op.or] = [
          { code: { [Op.like]: `%${search}%` } },
          { businessName: { [Op.like]: `%${search}%` } },
          { tradeName: { [Op.like]: `%${search}%` } },
          { firstName: { [Op.like]: `%${search}%` } },
          { lastName: { [Op.like]: `%${search}%` } },
          { documentNumber: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Type filter
      if (type) {
        where.type = type;
      }

      const { rows: customers, count } = await Customer.findAndCountAll({
        where,
        include: [
          {
            model: PriceList,
            as: 'priceList',
            attributes: ['id', 'code', 'name', 'currency']
          }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[sortBy, sortOrder.toUpperCase()]]
      });

      res.json({
        success: true,
        data: customers,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get active customers (for dropdowns)
  async getActiveCustomers(req, res, next) {
    try {
      const customers = await Customer.findAll({
        where: {
          status: 'active',
          isDeleted: false
        },
        attributes: ['id', 'code', 'firstName', 'lastName', 'businessName', 'tradeName', 'type', 'creditLimit', 'discountPercentage', 'priceListId'],
        order: [['code', 'ASC']],
        limit: 500
      });

      // Add computed fullName
      const customersWithName = customers.map(c => ({
        ...c.toJSON(),
        fullName: c.getFullName()
      }));

      res.json({
        success: true,
        data: customersWithName
      });
    } catch (error) {
      next(error);
    }
  }

  // Get customer by ID
  async getCustomerById(req, res, next) {
    try {
      const { id } = req.params;

      const customer = await Customer.findOne({
        where: {
          id,
          isDeleted: false
        },
        include: [
          {
            model: PriceList,
            as: 'priceList',
            attributes: ['id', 'code', 'name', 'currency', 'basePercentage']
          }
        ]
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Add computed fullName
      const customerData = {
        ...customer.toJSON(),
        fullName: customer.getFullName()
      };

      res.json({
        success: true,
        data: customerData
      });
    } catch (error) {
      next(error);
    }
  }

  // Create customer
  async createCustomer(req, res, next) {
    try {
      const {
        type,
        documentType,
        documentNumber,
        businessName,
        tradeName,
        firstName,
        lastName,
        email,
        phone,
        mobile,
        address,
        city,
        state,
        country,
        postalCode,
        creditLimit,
        creditDays,
        priceListId,
        discountPercentage,
        notes
      } = req.body;

      // Validate required fields based on type
      if (type === 'juridical' && !businessName) {
        return res.status(400).json({
          success: false,
          message: 'La razón social es obligatoria para personas jurídicas'
        });
      }

      if (type === 'natural' && (!firstName || !lastName)) {
        return res.status(400).json({
          success: false,
          message: 'El nombre y apellido son obligatorios para personas naturales'
        });
      }

      // Check if document number already exists
      const existingCustomer = await Customer.findOne({
        where: {
          documentNumber,
          isDeleted: false
        }
      });

      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: `Ya existe un cliente con el documento ${documentNumber}`
        });
      }

      // Create customer
      const customer = await Customer.create({
        type,
        documentType,
        documentNumber,
        businessName,
        tradeName,
        firstName,
        lastName,
        email,
        phone,
        mobile,
        address,
        city,
        state,
        country: country || 'Venezuela',
        postalCode,
        creditLimit: creditLimit || 0,
        creditDays: creditDays || 0,
        priceListId,
        discountPercentage: discountPercentage || 0,
        notes,
        status: 'active'
      });

      // Reload with associations
      await customer.reload({
        include: [
          {
            model: PriceList,
            as: 'priceList',
            attributes: ['id', 'code', 'name', 'currency']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: {
          ...customer.toJSON(),
          fullName: customer.getFullName()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update customer
  async updateCustomer(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // Don't allow updating these fields
      delete updateData.code;
      delete updateData.isDeleted;

      const customer = await Customer.findOne({
        where: {
          id,
          isDeleted: false
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Validate type-specific required fields
      if (updateData.type === 'juridical' && !updateData.businessName && !customer.businessName) {
        return res.status(400).json({
          success: false,
          message: 'La razón social es obligatoria para personas jurídicas'
        });
      }

      if (updateData.type === 'natural' &&
        ((!updateData.firstName && !customer.firstName) || (!updateData.lastName && !customer.lastName))) {
        return res.status(400).json({
          success: false,
          message: 'El nombre y apellido son obligatorios para personas naturales'
        });
      }

      // If changing document number, check uniqueness
      if (updateData.documentNumber && updateData.documentNumber !== customer.documentNumber) {
        const existing = await Customer.findOne({
          where: {
            documentNumber: updateData.documentNumber,
            id: { [Op.ne]: id },
            isDeleted: false
          }
        });

        if (existing) {
          return res.status(400).json({
            success: false,
            message: `Ya existe un cliente con el documento ${updateData.documentNumber}`
          });
        }
      }

      // Update customer
      await customer.update(updateData);

      // Reload with associations
      await customer.reload({
        include: [
          {
            model: PriceList,
            as: 'priceList',
            attributes: ['id', 'code', 'name', 'currency']
          }
        ]
      });

      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: {
          ...customer.toJSON(),
          fullName: customer.getFullName()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete customer (soft delete)
  async deleteCustomer(req, res, next) {
    try {
      const { id } = req.params;

      const customer = await Customer.findOne({
        where: {
          id,
          isDeleted: false
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Check if customer has sales
      const salesCount = await Sale.count({
        where: { customer_id: id }
      });

      if (salesCount > 0) {
        // Soft delete
        await customer.update({
          isDeleted: true,
          status: 'inactive'
        });

        return res.json({
          success: true,
          message: 'Cliente desactivado exitosamente (tiene ventas asociadas)'
        });
      }

      // Hard delete if no sales
      await customer.destroy();

      res.json({
        success: true,
        message: 'Cliente eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Validate credit availability
  async validateCredit(req, res, next) {
    try {
      const { id } = req.params;
      const { amount } = req.query;

      if (!amount || isNaN(amount)) {
        return res.status(400).json({
          success: false,
          message: 'El monto es requerido para validar el crédito'
        });
      }

      const customer = await Customer.findOne({
        where: {
          id,
          isDeleted: false
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      const creditLimit = parseFloat(customer.creditLimit || 0);
      const creditUsed = parseFloat(customer.creditUsed || 0);
      const availableCredit = Math.max(0, creditLimit - creditUsed);
      const requestedAmount = parseFloat(amount);
      const hasCredit = customer.hasAvailableCredit(requestedAmount);

      res.json({
        success: true,
        data: {
          customerId: id,
          customerName: customer.getFullName(),
          creditLimit,
          currentBalance: creditUsed,
          availableCredit,
          requestedAmount,
          hasAvailableCredit: hasCredit,
          creditStatus: hasCredit ? 'approved' : 'rejected'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get credit summary
  async getCreditSummary(req, res, next) {
    try {
      const { id } = req.params;

      const customer = await Customer.findOne({
        where: {
          id,
          isDeleted: false
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      const creditLimit = parseFloat(customer.creditLimit || 0);
      const creditUsed = parseFloat(customer.creditUsed || 0);
      const availableCredit = Math.max(0, creditLimit - creditUsed);
      const creditUsagePercent = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

      // Get pending credit sales with payment detail
      const pendingSales = await Sale.findAll({
        where: {
          customer_id: id,
          sale_type: 'credit',
          payment_status: { [Op.in]: ['pending', 'partial'] }
        },
        attributes: ['id', 'sale_number', 'sale_date', 'total', 'payment_status'],
        include: [{ model: SalePayment, as: 'payments', attributes: ['amount', 'payment_date'] }],
        order: [['sale_date', 'DESC']],
        limit: 10
      });

      res.json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            code: customer.code,
            name: customer.getFullName(),
            creditLimit,
            creditDays: customer.creditDays
          },
          credit: {
            limit: creditLimit,
            used: creditUsed,
            available: availableCredit,
            usagePercent: parseFloat(creditUsagePercent.toFixed(2))
          },
          pendingSales: pendingSales.map(s => {
            const paid = (s.payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
            return {
              id: s.id,
              sale_number: s.sale_number,
              sale_date: s.sale_date,
              total: parseFloat(s.total),
              paid,
              balance: parseFloat(s.total) - paid,
              payment_status: s.payment_status
            };
          })
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get customer statistics
  async getCustomerStats(req, res, next) {
    try {
      const { id } = req.params;

      const customer = await Customer.findOne({
        where: {
          id,
          isDeleted: false
        }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Get sales statistics
      const salesStats = await Sale.findAll({
        where: { customer_id: id },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalSales'],
          [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount'],
          [sequelize.fn('AVG', sequelize.col('total')), 'averageAmount']
        ],
        raw: true
      });

      // Get recent sales
      const recentSales = await Sale.findAll({
        where: { customer_id: id },
        attributes: ['id', 'sale_number', 'sale_date', 'total', 'payment_status'],
        order: [['sale_date', 'DESC']],
        limit: 5
      });

      // Get payment summary
      const paymentSummary = await Sale.findAll({
        where: { customer_id: id },
        attributes: [
          'payment_status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('total')), 'amount']
        ],
        group: ['payment_status'],
        raw: true
      });

      const stats = salesStats[0];

      res.json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            code: customer.code,
            name: customer.getFullName()
          },
          sales: {
            total: parseInt(stats.totalSales) || 0,
            totalAmount: parseFloat(stats.totalAmount) || 0,
            averageAmount: parseFloat(stats.averageAmount) || 0
          },
          paymentSummary: paymentSummary.map(p => ({
            status: p.payment_status,
            count: parseInt(p.count),
            amount: parseFloat(p.amount)
          })),
          recentSales: recentSales.map(s => ({
            ...s.toJSON(),
            total: parseFloat(s.total)
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get customers with overdue credit balances
  async getOverdueCustomers(req, res, next) {
    try {
      const today = new Date();

      // Find credit sales that are past due (sale_date + creditDays < today)
      const overdueSales = await Sale.findAll({
        where: {
          sale_type: 'credit',
          payment_status: { [Op.in]: ['pending', 'partial'] }
        },
        attributes: ['id', 'sale_number', 'sale_date', 'total', 'customer_id', 'payment_status'],
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'code', 'first_name', 'last_name', 'business_name', 'type', 'phone', 'mobile', 'credit_days', 'credit_limit', 'credit_used'],
            where: { isDeleted: false }
          },
          {
            model: SalePayment,
            as: 'payments',
            attributes: ['amount'],
            required: false
          }
        ]
      });

      // Filter and calculate overdue
      const overdueList = overdueSales
        .map(sale => {
          const customer = sale.customer;
          const creditDays = customer?.credit_days || 0;
          const dueDate = new Date(sale.sale_date);
          dueDate.setDate(dueDate.getDate() + creditDays);

          const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          const paid = (sale.payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);
          const balance = parseFloat(sale.total) - paid;

          return { sale, customer, dueDate, daysOverdue, balance };
        })
        .filter(item => item.daysOverdue > 0 && item.balance > 0)
        .sort((a, b) => b.daysOverdue - a.daysOverdue);

      res.json({
        success: true,
        data: overdueList.map(item => ({
          customer: {
            id: item.customer.id,
            code: item.customer.code,
            name: item.customer.getFullName ? item.customer.getFullName() : (item.customer.businessName || `${item.customer.firstName} ${item.customer.lastName}`),
            phone: item.customer.phone || item.customer.mobile
          },
          sale: {
            id: item.sale.id,
            sale_number: item.sale.sale_number,
            sale_date: item.sale.sale_date,
            total: parseFloat(item.sale.total),
            balance: item.balance,
            due_date: item.dueDate,
            days_overdue: item.daysOverdue
          },
          aging_bucket: item.daysOverdue <= 30 ? '0-30' : item.daysOverdue <= 60 ? '31-60' : item.daysOverdue <= 90 ? '61-90' : '+90'
        }))
      });
    } catch (error) {
      next(error);
    }
  }

}

module.exports = new CustomerController();
