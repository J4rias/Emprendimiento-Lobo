const { Customer, PriceList, Sale, SalePayment, CreditNote, ExchangeRate } = require('../models');
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

      const creditUsed = parseFloat(customer.creditUsed || 0);
      const requestedAmount = parseFloat(amount);

      // Sin límite de crédito: siempre aprobado
      res.json({
        success: true,
        data: {
          customerId: id,
          customerName: customer.getFullName(),
          creditLimit: 0,
          currentBalance: creditUsed,
          availableCredit: Infinity,
          requestedAmount,
          hasAvailableCredit: true,
          creditStatus: 'approved'
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

  // Get unified statement (ledger) for a single customer
  async getStatement(req, res, next) {
    try {
      const { id } = req.params;

      const customer = await Customer.findOne({
        where: { id, isDeleted: false }
      });

      if (!customer) {
        return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
      }

      // 1. Fetch Sales (Debts/Invoices) - Excluding cancelled ones
      const sales = await Sale.findAll({
        where: {
          customer_id: id,
          status: { [Op.notIn]: ['cancelled'] },
          sale_type: 'credit' // Usually we only care about credit sales for statements, or all sales? Let's include all to be thorough, but distinguish cash vs credit.
        },
        attributes: ['id', 'sale_number', 'sale_date', 'total', 'paid_amount', 'exchange_rate', 'sale_type', 'status']
      });

      const cashSales = await Sale.findAll({
        where: {
          customer_id: id,
          status: { [Op.notIn]: ['cancelled'] },
          sale_type: 'cash'
        },
        attributes: ['id', 'sale_number', 'sale_date', 'total', 'paid_amount', 'exchange_rate', 'sale_type', 'status']
      });

      // 2. Fetch Payments (Credits/Assets) — only for credit sales
      const payments = await SalePayment.findAll({
        include: [{
          model: Sale,
          as: 'sale',
          where: { customer_id: id, sale_type: 'credit' },
          attributes: ['id', 'sale_number', 'exchange_rate']
        }],
        attributes: ['id', 'payment_date', 'payment_method', 'amount', 'currency', 'exchange_rate', 'reference']
      });

      // 3. Fetch Credit Notes (Refunds/Assets)
      let creditNotes = [];
      try {
        if (CreditNote) {
          creditNotes = await CreditNote.findAll({
            where: {
              customer_id: id,
              status: { [Op.in]: ['approved', 'applied'] }
            },
            attributes: ['id', 'credit_note_number', 'credit_note_date', 'total', 'refund_method', 'type', 'exchange_rate', 'sale_id'],
            include: [{
              model: Sale,
              as: 'sale',
              attributes: ['exchange_rate'],
              required: false
            }]
          });
        }
      } catch (e) { /* ignore if CreditNote is not fully migrated visually yet */ }

      // Build credit-note totals per sale_id so sale rows can show net debt
      const cnBySaleId = {};
      for (const note of creditNotes) {
        const saleId = note.sale_id;
        if (!saleId) continue;
        const noteUSD = parseFloat(note.total || 0);
        const noteRate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
        if (!cnBySaleId[saleId]) cnBySaleId[saleId] = { usd: 0, cop: 0, notes: [] };
        cnBySaleId[saleId].usd += noteUSD;
        cnBySaleId[saleId].cop += Math.round(noteUSD * noteRate);
        cnBySaleId[saleId].notes.push({
          id: note.id,
          number: note.credit_note_number,
          date: note.credit_note_date,
          total_usd: noteUSD,
          total_cop: Math.round(noteUSD * noteRate),
          refund_method: note.refund_method
        });
      }

      // Unify data into Ledger
      const ledger = [];
      const summary = {};

      const allSales = [...sales, ...cashSales];

      // Process Sales (Charges)
      for (const sale of allSales) {
        const amountOrig = parseFloat(sale.total || 0);
        const saleCurrency = 'USD'; // Assuming sales totals are in USD in database (common pattern in this app)
        const rate = parseFloat(sale.exchange_rate || 1);

        const amtUSD = amountOrig; // If total is USD
        const amtCOP = amountOrig * rate;

        const cnData = cnBySaleId[sale.id] || { usd: 0, cop: 0, notes: [] };
        const saleJson = sale.toJSON ? sale.toJSON() : sale;
        const enrichedSale = {
          ...saleJson,
          cn_amount_usd: cnData.usd,
          cn_amount_cop: cnData.cop,
          applied_credit_notes: cnData.notes
        };

        // Record in USD
        if (!summary['USD']) summary['USD'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: parseFloat(customer.creditBalance || 0) };
        if (sale.sale_type === 'credit') summary['USD'].total_invoiced += amtUSD;
        ledger.push({
          id: `sale_${sale.id}_usd`,
          type: 'charge',
          date: new Date(sale.sale_date),
          reference: sale.sale_number,
          amount: amtUSD,
          currency: 'USD',
          description: `Venta ${sale.sale_type === 'cash' ? '(Contado)' : '(Crédito)'}`,
          original_amount: amountOrig,
          original_currency: saleCurrency,
          original_data: enrichedSale
        });

        // Record in COP
        if (!summary['COP']) summary['COP'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
        if (sale.sale_type === 'credit') summary['COP'].total_invoiced += amtCOP;
        ledger.push({
          id: `sale_${sale.id}_cop`,
          type: 'charge',
          date: new Date(sale.sale_date),
          reference: sale.sale_number,
          amount: amtCOP,
          currency: 'COP',
          description: `Venta ${sale.sale_type === 'cash' ? '(Contado)' : '(Crédito)'}`,
          original_amount: amountOrig,
          original_currency: saleCurrency,
          original_data: enrichedSale
        });
      }

      // Process Payments (Credits)
      for (const pay of payments) {
        const payCurrency = pay.currency || 'USD';
        const amountOrig = parseFloat(pay.amount || 0);
        // Use payment's own exchange_rate; if it's 1 (legacy USD records stored with rate=1), fall back to the sale's rate
        const rate = parseFloat(
          (pay.exchange_rate && parseFloat(pay.exchange_rate) !== 1) ? pay.exchange_rate : (pay.sale?.exchange_rate || 1)
        );

        let amtUSD, amtCOP;
        if (payCurrency === 'USD') {
          amtUSD = amountOrig;
          amtCOP = amountOrig * rate;
        } else if (payCurrency === 'COP') {
          amtCOP = amountOrig;
          amtUSD = amountOrig / rate;
        } else {
          amtUSD = amountOrig; // Simplified
          amtCOP = amountOrig * rate;
        }

        // Record in USD
        if (!summary['USD']) summary['USD'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
        summary['USD'].total_paid += amtUSD;
        ledger.push({
          id: `pay_${pay.id}_usd`,
          type: pay.payment_method === 'credit_balance' ? 'internal_transfer' : 'payment',
          date: new Date(pay.payment_date),
          reference: `PAGO-${pay.id}`,
          amount: amtUSD,
          currency: 'USD',
          description: `Abono a Venta ${pay.sale?.sale_number} (${pay.payment_method})`,
          isInternal: pay.payment_method === 'credit_balance',
          original_amount: amountOrig,
          original_currency: payCurrency,
          original_data: pay
        });

        // Record in COP
        if (!summary['COP']) summary['COP'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: parseFloat(customer.creditBalance || 0) * rate };
        summary['COP'].total_paid += amtCOP;
        ledger.push({
          id: `pay_${pay.id}_cop`,
          type: pay.payment_method === 'credit_balance' ? 'internal_transfer' : 'payment',
          date: new Date(pay.payment_date),
          reference: `PAGO-${pay.id}`,
          amount: amtCOP,
          currency: 'COP',
          description: `Abono a Venta ${pay.sale?.sale_number} (${pay.payment_method})`,
          isInternal: pay.payment_method === 'credit_balance',
          original_amount: amountOrig,
          original_currency: payCurrency,
          original_data: pay
        });
      }

      // Process Credit Notes (Credits)
      for (const note of creditNotes) {
        const amountUSD = parseFloat(note.total || 0);
        const rate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
        const amountCOP = Math.round(amountUSD * rate);

        ledger.push({
          id: `cn_${note.id}_usd`,
          type: 'credit',
          date: new Date(note.credit_note_date),
          reference: note.credit_note_number,
          amount: amountUSD,
          currency: 'USD',
          description: `Nota de Crédito (${note.refund_method})`,
          isInternal: false,
          original_data: note
        });

        ledger.push({
          id: `cn_${note.id}_cop`,
          type: 'credit',
          date: new Date(note.credit_note_date),
          reference: note.credit_note_number,
          amount: amountCOP,
          currency: 'COP',
          description: `Nota de Crédito (${note.refund_method})`,
          isInternal: false,
          original_data: note
        });
      }

      // Calculate Final Balances
      for (const curr in summary) {
        summary[curr].balance = Math.max(0, summary[curr].total_invoiced - summary[curr].total_paid);
        summary[curr].available_credit = 0;
      }

      // Calculate saldo a favor (two-step approach):
      // Step 1: Compute overpayment from credit sales with REAL (non-credit_balance) payments
      const realPaymentsBySale = {};
      for (const pay of payments) {
        if (pay.payment_method === 'credit_balance') continue;
        const saleId = pay.sale?.id;
        if (!saleId) continue;
        if (!realPaymentsBySale[saleId]) realPaymentsBySale[saleId] = [];
        realPaymentsBySale[saleId].push(pay);
      }
      let totalRealPaidCOP = 0;
      let totalInvoicedForReallyPaidCOP = 0;
      for (const sale of sales) {
        const saleRate = parseFloat(sale.exchange_rate || 1);
        const saleRealPays = realPaymentsBySale[sale.id] || [];
        if (saleRealPays.length === 0) continue;
        const paidCOP = saleRealPays.reduce((sum, p) => {
          if (p.currency === 'COP') return sum + parseFloat(p.amount);
          const payRate = parseFloat(p.exchange_rate && parseFloat(p.exchange_rate) !== 1 ? p.exchange_rate : saleRate);
          return sum + parseFloat(p.amount) * payRate;
        }, 0);
        totalInvoicedForReallyPaidCOP += parseFloat(sale.total) * saleRate;
        totalRealPaidCOP += paidCOP;
      }
      const overpaymentCOP = Math.max(0, totalRealPaidCOP - totalInvoicedForReallyPaidCOP);

      // Step 2: Subtract ALL credit_balance payments already used (any sale type)
      const allCBPayments = await SalePayment.findAll({
        include: [{
          model: Sale,
          as: 'sale',
          where: { customer_id: id },
          attributes: ['id', 'exchange_rate']
        }],
        where: { payment_method: 'credit_balance' },
        attributes: ['amount', 'currency', 'exchange_rate']
      });
      let creditBalanceUsedCOP = 0;
      for (const p of allCBPayments) {
        const rate = parseFloat((p.exchange_rate && parseFloat(p.exchange_rate) !== 1 ? p.exchange_rate : p.sale?.exchange_rate) || 1);
        creditBalanceUsedCOP += p.currency === 'COP' ? parseFloat(p.amount) : parseFloat(p.amount) * rate;
      }
      // Step 3: Add credit notes with credit_balance refund method (devolutions credited to wallet)
      let creditNotesCreditBalanceCOP = 0;
      for (const note of creditNotes) {
        if (note.refund_method === 'credit_balance') {
          const noteUSD = parseFloat(note.total || 0);
          // Prefer exchange_rate stored on the note (precise); fall back to sale's rate
          const noteRate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
          creditNotesCreditBalanceCOP += Math.round(noteUSD * noteRate);
        }
      }

      const availableCreditCOP = Math.max(0, overpaymentCOP + creditNotesCreditBalanceCOP - creditBalanceUsedCOP);

      if (summary['COP']) summary['COP'].available_credit = Math.round(availableCreditCOP);
      if (summary['USD']) summary['USD'].available_credit = 0;

      // Sort Ledger chronologically
      ledger.sort((a, b) => a.date - b.date);

      res.json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            name: customer.getFullName ? customer.getFullName() : customer.firstName + ' ' + customer.lastName,
            documentNumber: customer.documentNumber,
            credit_limit: parseFloat(customer.credit_limit || 0),
            credit_used: parseFloat(customer.credit_used || 0)
          },
          summary: summary,
          ledger: ledger
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Get customer credit balance (overpayment / saldo a favor)
  // Calculated in original COP amounts to avoid exchange rate drift
  async getCreditBalance(req, res, next) {
    try {
      const { id } = req.params;

      const sales = await Sale.findAll({
        where: { customer_id: id, sale_type: 'credit', status: { [Op.notIn]: ['cancelled'] } },
        attributes: ['id', 'total', 'exchange_rate'],
        include: [{ model: SalePayment, as: 'payments', attributes: ['amount', 'currency', 'exchange_rate', 'payment_method'] }]
      });

      // Aggregate approach: credit = total_paid - total_invoiced
      // Only include sales that have at least one payment (exclude pure pending/untouched)
      // Exclude credit_balance payments to avoid double-counting (they come from prior overpayments)
      let totalInvoicedCOP = 0;
      let totalPaidCOP = 0;
      for (const s of sales) {
        const saleRate = parseFloat(s.exchange_rate || 1);
        const realPayments = (s.payments || []).filter(p => p.payment_method !== 'credit_balance');
        const hasPaid = (s.payments || []).length > 0; // include sales paid via credit_balance
        const paidCOP = realPayments.reduce((pSum, p) => {
          if (p.currency === 'COP') return pSum + parseFloat(p.amount);
          return pSum + parseFloat(p.amount) * parseFloat(p.exchange_rate || saleRate);
        }, 0);
        // Include in invoiced if: sale has payments OR is the one being checked (completed/partial)
        if (hasPaid) {
          totalInvoicedCOP += parseFloat(s.total) * saleRate;
          totalPaidCOP += paidCOP;
        }
      }
      const creditBalanceCOP = Math.max(0, totalPaidCOP - totalInvoicedCOP);

      res.json({
        success: true,
        credit_balance_cop: Math.round(creditBalanceCOP),
        credit_balance_usd: 0 // not used, kept for compatibility
      });
    } catch (error) {
      next(error);
    }
  }

}

module.exports = new CustomerController();
