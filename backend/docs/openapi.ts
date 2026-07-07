import { z } from 'zod';

// ── Schema imports ─────────────────────────────────────────────────────────────
import { LoginSchema, ChangePasswordSchema } from '../schemas/auth.schema';
import { CreateBrandSchema, UpdateBrandSchema } from '../schemas/brand.schema';
import { CreateCategorySchema, UpdateCategorySchema } from '../schemas/category.schema';
import { CreatePackagingTypeSchema, UpdatePackagingTypeSchema } from '../schemas/packagingType.schema';
import { CreatePresentationTypeSchema, UpdatePresentationTypeSchema } from '../schemas/presentationType.schema';
import { CreateExchangeRateSchema, UpdateExchangeRateSchema } from '../schemas/exchangeRate.schema';
import { UpdateCompanySchema } from '../schemas/company.schema';
import { CreateRoleSchema, UpdateRoleSchema } from '../schemas/role.schema';
import { CreateUserSchema, UpdateUserSchema } from '../schemas/user.schema';
import { CreateDeliverySchema, UpdateDeliverySchema, ConfirmDeliverySchema, CancelDeliverySchema } from '../schemas/delivery.schema';
import { CreateTransferSchema, CancelTransferSchema } from '../schemas/transfer.schema';
import { CreateCreditNoteSchema, CancelCreditNoteSchema } from '../schemas/creditNote.schema';
import { CreateSupplierSchema, UpdateSupplierSchema } from '../schemas/supplier.schema';
import { CreateInventorySchema } from '../schemas/inventory.schema';
import { CreateCustomerSchema, UpdateCustomerSchema } from '../schemas/customer.schema';
import { CreateQuoteSchema, UpdateQuoteSchema } from '../schemas/quote.schema';
import { CreatePriceListSchema, UpdatePriceListSchema, UpdateDetailSchema, DuplicatePriceListSchema } from '../schemas/priceList.schema';
import { CreateProductSchema, UpdateProductSchema, CreatePresentationSchema, UpdatePresentationSchema } from '../schemas/product.schema';
import { CreateSupplierPaymentSchema, UpdateSupplierPaymentSchema, CancelPaymentSchema } from '../schemas/supplierPayment.schema';
import { CreateReservationSchema, UpdateReservationSchema, CleanupExpiredSchema } from '../schemas/pos.schema';
import { ReversePaymentSchema, ValidateAdminPinSchema, UpdateArSchema } from '../schemas/ar.schema';
import { CreateSaleSchema, UpdateSaleSchema, ValidateCreditPinSchema, CancelSaleSchema, AddPaymentSchema } from '../schemas/sale.schema';
import { CreatePurchaseOrderSchema, UpdatePurchaseOrderSchema, CancelPurchaseOrderSchema, ReceiveMerchandiseSchema } from '../schemas/purchaseOrder.schema';
import { CreatePreOrderSchema, ConvertPreOrderSchema } from '../schemas/preOrder.schema';
import { CreateBankSchema, UpdateBankSchema } from '../schemas/bank.schema';

// ── Helpers ────────────────────────────────────────────────────────────────────

function cleanSchema(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '$schema') continue;
    if (k === 'additionalProperties' && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) {
      result[k] = true;
    } else {
      result[k] = cleanSchema(v);
    }
  }
  return result;
}

const s = (schema: z.ZodTypeAny): Record<string, any> =>
  cleanSchema((z as any).toJSONSchema(schema) as Record<string, any>);

const secured = [{ bearerAuth: [] }];

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function body(schemaName: string) {
  return { required: true, content: { 'application/json': { schema: ref(schemaName) } } };
}

function idParam(description: string) {
  return [{ name: 'id', in: 'path', required: true, description, schema: { type: 'integer' } }];
}

function qp(name: string, type = 'string', description?: string) {
  return { name, in: 'query', schema: { type }, ...(description ? { description } : {}) };
}

const E = {
  400: { description: 'Datos inválidos' },
  401: { description: 'No autorizado' },
  404: { description: 'No encontrado' },
  500: { description: 'Error interno del servidor' },
};

const ok = (description = 'OK') => ({ 200: { description }, ...E });
const created = (description = 'Creado') => ({ 201: { description }, ...E });

// ── OpenAPI document ───────────────────────────────────────────────────────────

export function buildOpenApiSpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Lobo ERP — API',
      version: '1.0.0',
      description: 'API de gestión para distribuidora de víveres (Emprendimiento Lobo). ' +
        'Requiere `Authorization: Bearer <token>` en todos los endpoints excepto `POST /auth/login` y `GET /catalog`.',
    },
    servers: [{ url: '/api', description: 'API base' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        // Auth
        Login: s(LoginSchema),
        ChangePassword: s(ChangePasswordSchema),
        // Brands
        CreateBrand: s(CreateBrandSchema),
        UpdateBrand: s(UpdateBrandSchema),
        // Categories
        CreateCategory: s(CreateCategorySchema),
        UpdateCategory: s(UpdateCategorySchema),
        // Packaging Types
        CreatePackagingType: s(CreatePackagingTypeSchema),
        UpdatePackagingType: s(UpdatePackagingTypeSchema),
        // Presentation Types
        CreatePresentationType: s(CreatePresentationTypeSchema),
        UpdatePresentationType: s(UpdatePresentationTypeSchema),
        // Exchange Rates
        CreateExchangeRate: s(CreateExchangeRateSchema),
        UpdateExchangeRate: s(UpdateExchangeRateSchema),
        // Company
        UpdateCompany: s(UpdateCompanySchema),
        // Roles
        CreateRole: s(CreateRoleSchema),
        UpdateRole: s(UpdateRoleSchema),
        // Users
        CreateUser: s(CreateUserSchema),
        UpdateUser: s(UpdateUserSchema),
        // Suppliers
        CreateSupplier: s(CreateSupplierSchema),
        UpdateSupplier: s(UpdateSupplierSchema),
        // Customers
        CreateCustomer: s(CreateCustomerSchema),
        UpdateCustomer: s(UpdateCustomerSchema),
        // Banks
        CreateBank: s(CreateBankSchema),
        UpdateBank: s(UpdateBankSchema),
        // Products
        CreateProduct: s(CreateProductSchema),
        UpdateProduct: s(UpdateProductSchema),
        CreatePresentation: s(CreatePresentationSchema),
        UpdatePresentation: s(UpdatePresentationSchema),
        // Inventory
        CreateInventory: s(CreateInventorySchema),
        // Price Lists
        CreatePriceList: s(CreatePriceListSchema),
        UpdatePriceList: s(UpdatePriceListSchema),
        UpdatePriceListDetail: s(UpdateDetailSchema),
        DuplicatePriceList: s(DuplicatePriceListSchema),
        // Quotes
        CreateQuote: s(CreateQuoteSchema),
        UpdateQuote: s(UpdateQuoteSchema),
        // Sales
        CreateSale: s(CreateSaleSchema),
        UpdateSale: s(UpdateSaleSchema),
        ValidateCreditPin: s(ValidateCreditPinSchema),
        CancelSale: s(CancelSaleSchema),
        AddSalePayment: s(AddPaymentSchema),
        // Purchase Orders
        CreatePurchaseOrder: s(CreatePurchaseOrderSchema),
        UpdatePurchaseOrder: s(UpdatePurchaseOrderSchema),
        CancelPurchaseOrder: s(CancelPurchaseOrderSchema),
        ReceiveMerchandise: s(ReceiveMerchandiseSchema),
        // Supplier Payments
        CreateSupplierPayment: s(CreateSupplierPaymentSchema),
        UpdateSupplierPayment: s(UpdateSupplierPaymentSchema),
        CancelSupplierPayment: s(CancelPaymentSchema),
        // Deliveries
        CreateDelivery: s(CreateDeliverySchema),
        UpdateDelivery: s(UpdateDeliverySchema),
        ConfirmDelivery: s(ConfirmDeliverySchema),
        CancelDelivery: s(CancelDeliverySchema),
        // Transfers
        CreateTransfer: s(CreateTransferSchema),
        CancelTransfer: s(CancelTransferSchema),
        // Credit Notes
        CreateCreditNote: s(CreateCreditNoteSchema),
        CancelCreditNote: s(CancelCreditNoteSchema),
        // Pre-Orders
        CreatePreOrder: s(CreatePreOrderSchema),
        ConvertPreOrder: s(ConvertPreOrderSchema),
        // POS
        CreateReservation: s(CreateReservationSchema),
        UpdateReservation: s(UpdateReservationSchema),
        CleanupExpired: s(CleanupExpiredSchema),
        // AR
        ReversePayment: s(ReversePaymentSchema),
        ValidateAdminPin: s(ValidateAdminPinSchema),
        UpdateAr: s(UpdateArSchema),
      },
    },

    paths: {
      // ── Autenticación ────────────────────────────────────────────────────────
      '/auth/login': {
        post: {
          tags: ['Autenticación'],
          summary: 'Iniciar sesión',
          requestBody: body('Login'),
          responses: ok('Token JWT + datos del usuario'),
        },
      },
      '/auth/me': {
        get: {
          tags: ['Autenticación'],
          summary: 'Usuario autenticado',
          security: secured,
          responses: ok('Datos del usuario actual'),
        },
      },
      '/auth/change-password': {
        post: {
          tags: ['Autenticación'],
          summary: 'Cambiar contraseña',
          security: secured,
          requestBody: body('ChangePassword'),
          responses: ok('Contraseña actualizada'),
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Autenticación'],
          summary: 'Cerrar sesión',
          security: secured,
          responses: ok('Sesión cerrada'),
        },
      },

      // ── Catálogo público ─────────────────────────────────────────────────────
      '/catalog': {
        get: {
          tags: ['Catálogo'],
          summary: 'Catálogo público de productos con precios y stock',
          responses: ok('Lista de productos con stock y precios de la lista activa'),
        },
      },

      // ── Marcas ───────────────────────────────────────────────────────────────
      '/brands': {
        get: {
          tags: ['Marcas'],
          summary: 'Listar marcas',
          security: secured,
          responses: ok('Lista de marcas activas'),
        },
        post: {
          tags: ['Marcas'],
          summary: 'Crear marca',
          security: secured,
          requestBody: body('CreateBrand'),
          responses: created('Marca creada'),
        },
      },
      '/brands/{id}': {
        get: {
          tags: ['Marcas'],
          summary: 'Obtener marca por ID',
          security: secured,
          parameters: idParam('ID de la marca'),
          responses: ok('Datos de la marca'),
        },
        put: {
          tags: ['Marcas'],
          summary: 'Actualizar marca',
          security: secured,
          parameters: idParam('ID de la marca'),
          requestBody: body('UpdateBrand'),
          responses: ok('Marca actualizada'),
        },
        delete: {
          tags: ['Marcas'],
          summary: 'Eliminar marca (soft delete)',
          security: secured,
          parameters: idParam('ID de la marca'),
          responses: ok('Marca eliminada'),
        },
      },

      // ── Categorías ───────────────────────────────────────────────────────────
      '/categories': {
        get: {
          tags: ['Categorías'],
          summary: 'Listar categorías',
          security: secured,
          responses: ok('Árbol de categorías'),
        },
        post: {
          tags: ['Categorías'],
          summary: 'Crear categoría',
          security: secured,
          requestBody: body('CreateCategory'),
          responses: created('Categoría creada'),
        },
      },
      '/categories/{id}': {
        get: {
          tags: ['Categorías'],
          summary: 'Obtener categoría por ID',
          security: secured,
          parameters: idParam('ID de la categoría'),
          responses: ok('Datos de la categoría'),
        },
        put: {
          tags: ['Categorías'],
          summary: 'Actualizar categoría',
          security: secured,
          parameters: idParam('ID de la categoría'),
          requestBody: body('UpdateCategory'),
          responses: ok('Categoría actualizada'),
        },
        delete: {
          tags: ['Categorías'],
          summary: 'Eliminar categoría (soft delete)',
          security: secured,
          parameters: idParam('ID de la categoría'),
          responses: ok('Categoría eliminada'),
        },
      },

      // ── Tipos de empaque ─────────────────────────────────────────────────────
      '/packaging-types': {
        get: {
          tags: ['Tipos de empaque'],
          summary: 'Listar tipos de empaque',
          security: secured,
          responses: ok('Lista de tipos de empaque'),
        },
        post: {
          tags: ['Tipos de empaque'],
          summary: 'Crear tipo de empaque',
          security: secured,
          requestBody: body('CreatePackagingType'),
          responses: created('Tipo de empaque creado'),
        },
      },
      '/packaging-types/{id}': {
        put: {
          tags: ['Tipos de empaque'],
          summary: 'Actualizar tipo de empaque',
          security: secured,
          parameters: idParam('ID del tipo de empaque'),
          requestBody: body('UpdatePackagingType'),
          responses: ok('Tipo de empaque actualizado'),
        },
        delete: {
          tags: ['Tipos de empaque'],
          summary: 'Eliminar tipo de empaque (soft delete)',
          security: secured,
          parameters: idParam('ID del tipo de empaque'),
          responses: ok('Tipo de empaque eliminado'),
        },
      },

      // ── Tipos de presentación ────────────────────────────────────────────────
      '/presentation-types': {
        get: {
          tags: ['Tipos de presentación'],
          summary: 'Listar tipos de presentación',
          security: secured,
          responses: ok('Lista de tipos de presentación'),
        },
        post: {
          tags: ['Tipos de presentación'],
          summary: 'Crear tipo de presentación',
          security: secured,
          requestBody: body('CreatePresentationType'),
          responses: created('Tipo de presentación creado'),
        },
      },
      '/presentation-types/{id}': {
        put: {
          tags: ['Tipos de presentación'],
          summary: 'Actualizar tipo de presentación',
          security: secured,
          parameters: idParam('ID del tipo de presentación'),
          requestBody: body('UpdatePresentationType'),
          responses: ok('Tipo de presentación actualizado'),
        },
        delete: {
          tags: ['Tipos de presentación'],
          summary: 'Eliminar tipo de presentación (soft delete)',
          security: secured,
          parameters: idParam('ID del tipo de presentación'),
          responses: ok('Tipo de presentación eliminado'),
        },
      },

      // ── Tasas de cambio ──────────────────────────────────────────────────────
      '/exchange-rates': {
        get: {
          tags: ['Tasas de cambio'],
          summary: 'Historial de tasas de cambio',
          security: secured,
          parameters: [
            qp('from_currency', 'string', 'Moneda origen (USD, VES, COP)'),
            qp('to_currency', 'string', 'Moneda destino'),
            qp('limit', 'integer', 'Límite de resultados'),
          ],
          responses: ok('Lista de tasas de cambio'),
        },
        post: {
          tags: ['Tasas de cambio'],
          summary: 'Registrar tasa de cambio',
          security: secured,
          requestBody: body('CreateExchangeRate'),
          responses: created('Tasa registrada'),
        },
      },
      '/exchange-rates/latest': {
        get: {
          tags: ['Tasas de cambio'],
          summary: 'Tasas de cambio vigentes',
          security: secured,
          responses: ok('Última tasa por par de monedas'),
        },
      },
      '/exchange-rates/convert': {
        get: {
          tags: ['Tasas de cambio'],
          summary: 'Convertir monto entre monedas',
          security: secured,
          parameters: [
            qp('amount', 'number', 'Monto a convertir'),
            qp('from', 'string', 'Moneda origen'),
            qp('to', 'string', 'Moneda destino'),
          ],
          responses: ok('Resultado de la conversión'),
        },
      },
      '/exchange-rates/{id}': {
        get: {
          tags: ['Tasas de cambio'],
          summary: 'Obtener tasa por ID',
          security: secured,
          parameters: idParam('ID de la tasa'),
          responses: ok('Tasa de cambio'),
        },
        put: {
          tags: ['Tasas de cambio'],
          summary: 'Actualizar tasa de cambio',
          security: secured,
          parameters: idParam('ID de la tasa'),
          requestBody: body('UpdateExchangeRate'),
          responses: ok('Tasa actualizada'),
        },
        delete: {
          tags: ['Tasas de cambio'],
          summary: 'Eliminar tasa de cambio',
          security: secured,
          parameters: idParam('ID de la tasa'),
          responses: ok('Tasa eliminada'),
        },
      },

      // ── Empresa ──────────────────────────────────────────────────────────────
      '/company': {
        get: {
          tags: ['Empresa'],
          summary: 'Obtener configuración de la empresa',
          security: secured,
          responses: ok('Datos de la empresa'),
        },
        put: {
          tags: ['Empresa'],
          summary: 'Actualizar configuración de la empresa',
          security: secured,
          requestBody: body('UpdateCompany'),
          responses: ok('Configuración actualizada'),
        },
      },

      // ── Roles ────────────────────────────────────────────────────────────────
      '/roles': {
        get: {
          tags: ['Roles'],
          summary: 'Listar roles',
          security: secured,
          responses: ok('Lista de roles con permisos'),
        },
        post: {
          tags: ['Roles'],
          summary: 'Crear rol',
          security: secured,
          requestBody: body('CreateRole'),
          responses: created('Rol creado'),
        },
      },
      '/roles/{id}': {
        get: {
          tags: ['Roles'],
          summary: 'Obtener rol por ID',
          security: secured,
          parameters: idParam('ID del rol'),
          responses: ok('Datos del rol'),
        },
        put: {
          tags: ['Roles'],
          summary: 'Actualizar rol',
          security: secured,
          parameters: idParam('ID del rol'),
          requestBody: body('UpdateRole'),
          responses: ok('Rol actualizado'),
        },
        delete: {
          tags: ['Roles'],
          summary: 'Eliminar rol',
          security: secured,
          parameters: idParam('ID del rol'),
          responses: ok('Rol eliminado'),
        },
      },

      // ── Usuarios ─────────────────────────────────────────────────────────────
      '/users': {
        get: {
          tags: ['Usuarios'],
          summary: 'Listar usuarios',
          security: secured,
          responses: ok('Lista de usuarios'),
        },
        post: {
          tags: ['Usuarios'],
          summary: 'Crear usuario',
          security: secured,
          requestBody: body('CreateUser'),
          responses: created('Usuario creado'),
        },
      },
      '/users/{id}': {
        get: {
          tags: ['Usuarios'],
          summary: 'Obtener usuario por ID',
          security: secured,
          parameters: idParam('ID del usuario'),
          responses: ok('Datos del usuario'),
        },
        put: {
          tags: ['Usuarios'],
          summary: 'Actualizar usuario',
          security: secured,
          parameters: idParam('ID del usuario'),
          requestBody: body('UpdateUser'),
          responses: ok('Usuario actualizado'),
        },
        delete: {
          tags: ['Usuarios'],
          summary: 'Eliminar usuario (soft delete)',
          security: secured,
          parameters: idParam('ID del usuario'),
          responses: ok('Usuario eliminado'),
        },
      },

      // ── Proveedores ──────────────────────────────────────────────────────────
      '/suppliers': {
        get: {
          tags: ['Proveedores'],
          summary: 'Listar proveedores',
          security: secured,
          responses: ok('Lista de proveedores'),
        },
        post: {
          tags: ['Proveedores'],
          summary: 'Crear proveedor',
          security: secured,
          requestBody: body('CreateSupplier'),
          responses: created('Proveedor creado'),
        },
      },
      '/suppliers/{id}': {
        get: {
          tags: ['Proveedores'],
          summary: 'Obtener proveedor por ID',
          security: secured,
          parameters: idParam('ID del proveedor'),
          responses: ok('Datos del proveedor'),
        },
        put: {
          tags: ['Proveedores'],
          summary: 'Actualizar proveedor',
          security: secured,
          parameters: idParam('ID del proveedor'),
          requestBody: body('UpdateSupplier'),
          responses: ok('Proveedor actualizado'),
        },
        delete: {
          tags: ['Proveedores'],
          summary: 'Eliminar proveedor (soft delete)',
          security: secured,
          parameters: idParam('ID del proveedor'),
          responses: ok('Proveedor eliminado'),
        },
      },

      // ── Clientes ─────────────────────────────────────────────────────────────
      '/customers': {
        get: {
          tags: ['Clientes'],
          summary: 'Listar clientes',
          security: secured,
          parameters: [
            qp('search', 'string', 'Búsqueda por nombre o RIF'),
            qp('price_list_id', 'integer', 'Filtrar por lista de precios'),
          ],
          responses: ok('Lista de clientes'),
        },
        post: {
          tags: ['Clientes'],
          summary: 'Crear cliente',
          security: secured,
          requestBody: body('CreateCustomer'),
          responses: created('Cliente creado'),
        },
      },
      '/customers/{id}': {
        get: {
          tags: ['Clientes'],
          summary: 'Obtener cliente por ID',
          security: secured,
          parameters: idParam('ID del cliente'),
          responses: ok('Datos del cliente'),
        },
        put: {
          tags: ['Clientes'],
          summary: 'Actualizar cliente',
          security: secured,
          parameters: idParam('ID del cliente'),
          requestBody: body('UpdateCustomer'),
          responses: ok('Cliente actualizado'),
        },
        delete: {
          tags: ['Clientes'],
          summary: 'Eliminar cliente (soft delete)',
          security: secured,
          parameters: idParam('ID del cliente'),
          responses: ok('Cliente eliminado o desactivado'),
        },
      },

      // ── Bancos ───────────────────────────────────────────────────────────────
      '/banks': {
        get: {
          tags: ['Bancos'],
          summary: 'Listar bancos / billeteras',
          security: secured,
          parameters: [
            qp('currency', 'string', 'Filtrar por moneda'),
            qp('is_active', 'boolean', 'Solo activos'),
          ],
          responses: ok('Lista de bancos'),
        },
        post: {
          tags: ['Bancos'],
          summary: 'Crear banco',
          security: secured,
          requestBody: body('CreateBank'),
          responses: created('Banco creado'),
        },
      },
      '/banks/{id}': {
        get: {
          tags: ['Bancos'],
          summary: 'Obtener banco por ID',
          security: secured,
          parameters: idParam('ID del banco'),
          responses: ok('Datos del banco'),
        },
        put: {
          tags: ['Bancos'],
          summary: 'Actualizar banco',
          security: secured,
          parameters: idParam('ID del banco'),
          requestBody: body('UpdateBank'),
          responses: ok('Banco actualizado'),
        },
        delete: {
          tags: ['Bancos'],
          summary: 'Desactivar banco',
          security: secured,
          parameters: idParam('ID del banco'),
          responses: ok('Banco desactivado'),
        },
      },

      // ── Productos ────────────────────────────────────────────────────────────
      '/products': {
        get: {
          tags: ['Productos'],
          summary: 'Listar productos',
          security: secured,
          parameters: [
            qp('search', 'string', 'Búsqueda por nombre o SKU'),
            qp('category_id', 'integer', 'Filtrar por categoría'),
            qp('is_active', 'boolean', 'Solo activos'),
          ],
          responses: ok('Lista de productos'),
        },
        post: {
          tags: ['Productos'],
          summary: 'Crear producto',
          security: secured,
          requestBody: body('CreateProduct'),
          responses: created('Producto creado'),
        },
      },
      '/products/{id}': {
        get: {
          tags: ['Productos'],
          summary: 'Obtener producto por ID',
          security: secured,
          parameters: idParam('ID del producto'),
          responses: ok('Producto con presentaciones y barcodes'),
        },
        put: {
          tags: ['Productos'],
          summary: 'Actualizar producto',
          security: secured,
          parameters: idParam('ID del producto'),
          requestBody: body('UpdateProduct'),
          responses: ok('Producto actualizado'),
        },
        delete: {
          tags: ['Productos'],
          summary: 'Eliminar producto (soft delete)',
          security: secured,
          parameters: idParam('ID del producto'),
          responses: ok('Producto eliminado'),
        },
      },
      '/products/{id}/presentations': {
        post: {
          tags: ['Productos'],
          summary: 'Agregar presentación al producto',
          security: secured,
          parameters: idParam('ID del producto'),
          requestBody: body('CreatePresentation'),
          responses: created('Presentación creada'),
        },
      },
      '/products/presentations/{presentationId}': {
        put: {
          tags: ['Productos'],
          summary: 'Actualizar presentación',
          security: secured,
          parameters: [{ name: 'presentationId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: body('UpdatePresentation'),
          responses: ok('Presentación actualizada'),
        },
        delete: {
          tags: ['Productos'],
          summary: 'Eliminar presentación',
          security: secured,
          parameters: [{ name: 'presentationId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: ok('Presentación eliminada'),
        },
      },
      '/products/presentations/{presentationId}/set-default': {
        put: {
          tags: ['Productos'],
          summary: 'Marcar presentación como predeterminada',
          security: secured,
          parameters: [{ name: 'presentationId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: ok('Presentación predeterminada actualizada'),
        },
      },

      // ── Inventario ───────────────────────────────────────────────────────────
      '/inventory': {
        get: {
          tags: ['Inventario'],
          summary: 'Stock actual por producto y almacén',
          security: secured,
          parameters: [
            qp('product_id', 'integer', 'Filtrar por producto'),
            qp('warehouse_id', 'integer', 'Filtrar por almacén'),
          ],
          responses: ok('Inventario actual'),
        },
      },
      '/inventory/adjust': {
        post: {
          tags: ['Inventario'],
          summary: 'Ajuste de inventario (ingreso / egreso manual)',
          security: secured,
          requestBody: body('CreateInventory'),
          responses: created('Ajuste registrado'),
        },
      },
      '/inventory/{productId}': {
        get: {
          tags: ['Inventario'],
          summary: 'Stock de un producto en todos los almacenes',
          security: secured,
          parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: ok('Stock por almacén'),
        },
      },
      '/inventory/movements': {
        get: {
          tags: ['Inventario'],
          summary: 'Historial de movimientos de inventario',
          security: secured,
          parameters: [
            qp('product_id', 'integer'),
            qp('from', 'string', 'Fecha inicio (ISO 8601)'),
            qp('to', 'string', 'Fecha fin (ISO 8601)'),
          ],
          responses: ok('Lista de movimientos'),
        },
      },

      // ── Transferencias ───────────────────────────────────────────────────────
      '/transfers': {
        get: {
          tags: ['Transferencias'],
          summary: 'Listar transferencias entre almacenes',
          security: secured,
          responses: ok('Lista de transferencias'),
        },
        post: {
          tags: ['Transferencias'],
          summary: 'Crear transferencia',
          security: secured,
          requestBody: body('CreateTransfer'),
          responses: created('Transferencia creada'),
        },
      },
      '/transfers/{id}': {
        get: {
          tags: ['Transferencias'],
          summary: 'Obtener transferencia por ID',
          security: secured,
          parameters: idParam('ID de la transferencia'),
          responses: ok('Datos de la transferencia'),
        },
      },
      '/transfers/{id}/receive': {
        post: {
          tags: ['Transferencias'],
          summary: 'Confirmar recepción de transferencia',
          security: secured,
          parameters: idParam('ID de la transferencia'),
          responses: ok('Transferencia recibida, stock actualizado'),
        },
      },
      '/transfers/{id}/cancel': {
        post: {
          tags: ['Transferencias'],
          summary: 'Cancelar transferencia',
          security: secured,
          parameters: idParam('ID de la transferencia'),
          requestBody: body('CancelTransfer'),
          responses: ok('Transferencia cancelada'),
        },
      },

      // ── Listas de precios ────────────────────────────────────────────────────
      '/price-lists': {
        get: {
          tags: ['Listas de precios'],
          summary: 'Listar listas de precios',
          security: secured,
          responses: ok('Lista de listas de precios'),
        },
        post: {
          tags: ['Listas de precios'],
          summary: 'Crear lista de precios',
          security: secured,
          requestBody: body('CreatePriceList'),
          responses: created('Lista de precios creada'),
        },
      },
      '/price-lists/{id}': {
        get: {
          tags: ['Listas de precios'],
          summary: 'Obtener lista de precios con detalles',
          security: secured,
          parameters: idParam('ID de la lista'),
          responses: ok('Lista con todos sus productos y precios'),
        },
        put: {
          tags: ['Listas de precios'],
          summary: 'Actualizar lista de precios',
          security: secured,
          parameters: idParam('ID de la lista'),
          requestBody: body('UpdatePriceList'),
          responses: ok('Lista actualizada'),
        },
        delete: {
          tags: ['Listas de precios'],
          summary: 'Eliminar lista de precios (soft delete)',
          security: secured,
          parameters: idParam('ID de la lista'),
          responses: ok('Lista eliminada'),
        },
      },
      '/price-lists/{id}/detail': {
        patch: {
          tags: ['Listas de precios'],
          summary: 'Actualizar precio de un ítem en la lista (auto-save)',
          security: secured,
          parameters: idParam('ID de la lista'),
          requestBody: body('UpdatePriceListDetail'),
          responses: ok('Detalle actualizado'),
        },
      },
      '/price-lists/{id}/duplicate': {
        post: {
          tags: ['Listas de precios'],
          summary: 'Duplicar lista de precios',
          security: secured,
          parameters: idParam('ID de la lista a duplicar'),
          requestBody: body('DuplicatePriceList'),
          responses: created('Nueva lista creada'),
        },
      },
      '/price-lists/{id}/export-csv': {
        get: {
          tags: ['Listas de precios'],
          summary: 'Exportar lista de precios como CSV',
          security: secured,
          parameters: idParam('ID de la lista'),
          responses: { 200: { description: 'Archivo CSV' }, ...E },
        },
      },
      '/price-lists/products-with-stock': {
        get: {
          tags: ['Listas de precios'],
          summary: 'Productos con stock disponible para agregar a lista',
          security: secured,
          responses: ok('Productos con stock y presentaciones'),
        },
      },

      // ── Cotizaciones ─────────────────────────────────────────────────────────
      '/quotes': {
        get: {
          tags: ['Cotizaciones'],
          summary: 'Listar cotizaciones',
          security: secured,
          parameters: [
            qp('status', 'string', 'pending | approved | rejected | converted'),
            qp('customer_id', 'integer'),
          ],
          responses: ok('Lista de cotizaciones'),
        },
        post: {
          tags: ['Cotizaciones'],
          summary: 'Crear cotización',
          security: secured,
          requestBody: body('CreateQuote'),
          responses: created('Cotización creada'),
        },
      },
      '/quotes/{id}': {
        get: {
          tags: ['Cotizaciones'],
          summary: 'Obtener cotización por ID',
          security: secured,
          parameters: idParam('ID de la cotización'),
          responses: ok('Datos de la cotización'),
        },
        put: {
          tags: ['Cotizaciones'],
          summary: 'Actualizar cotización',
          security: secured,
          parameters: idParam('ID de la cotización'),
          requestBody: body('UpdateQuote'),
          responses: ok('Cotización actualizada'),
        },
        delete: {
          tags: ['Cotizaciones'],
          summary: 'Eliminar cotización (soft delete)',
          security: secured,
          parameters: idParam('ID de la cotización'),
          responses: ok('Cotización eliminada'),
        },
      },
      '/quotes/{id}/convert': {
        post: {
          tags: ['Cotizaciones'],
          summary: 'Convertir cotización a venta',
          security: secured,
          parameters: idParam('ID de la cotización'),
          responses: created('Venta creada a partir de la cotización'),
        },
      },

      // ── Ventas ───────────────────────────────────────────────────────────────
      '/sales': {
        get: {
          tags: ['Ventas'],
          summary: 'Listar ventas',
          security: secured,
          parameters: [
            qp('status', 'string', 'pending | completed | cancelled | returned | delivered'),
            qp('from', 'string', 'Fecha inicio'),
            qp('to', 'string', 'Fecha fin'),
            qp('customer_id', 'integer'),
            qp('user_id', 'integer'),
          ],
          responses: ok('Lista de ventas'),
        },
        post: {
          tags: ['Ventas'],
          summary: 'Crear venta',
          security: secured,
          requestBody: body('CreateSale'),
          responses: created('Venta creada, stock descontado'),
        },
      },
      '/sales/validate-credit-pin': {
        post: {
          tags: ['Ventas'],
          summary: 'Validar PIN de crédito del cliente',
          security: secured,
          requestBody: body('ValidateCreditPin'),
          responses: ok('PIN válido o inválido'),
        },
      },
      '/sales/{id}': {
        get: {
          tags: ['Ventas'],
          summary: 'Obtener venta por ID',
          security: secured,
          parameters: idParam('ID de la venta'),
          responses: ok('Venta con detalles y pagos'),
        },
        patch: {
          tags: ['Ventas'],
          summary: 'Actualizar venta',
          security: secured,
          parameters: idParam('ID de la venta'),
          requestBody: body('UpdateSale'),
          responses: ok('Venta actualizada'),
        },
      },
      '/sales/{id}/cancel': {
        post: {
          tags: ['Ventas'],
          summary: 'Cancelar venta y revertir stock',
          security: secured,
          parameters: idParam('ID de la venta'),
          requestBody: body('CancelSale'),
          responses: ok('Venta cancelada'),
        },
      },
      '/sales/{id}/payments': {
        post: {
          tags: ['Ventas'],
          summary: 'Registrar abono / pago adicional a la venta',
          security: secured,
          parameters: idParam('ID de la venta'),
          requestBody: body('AddSalePayment'),
          responses: created('Pago registrado'),
        },
      },

      // ── Órdenes de compra ────────────────────────────────────────────────────
      '/purchase-orders': {
        get: {
          tags: ['Órdenes de compra'],
          summary: 'Listar órdenes de compra',
          security: secured,
          parameters: [
            qp('status', 'string', 'draft | approved | received | cancelled'),
            qp('supplier_id', 'integer'),
          ],
          responses: ok('Lista de órdenes de compra'),
        },
        post: {
          tags: ['Órdenes de compra'],
          summary: 'Crear orden de compra',
          security: secured,
          requestBody: body('CreatePurchaseOrder'),
          responses: created('Orden creada'),
        },
      },
      '/purchase-orders/{id}': {
        get: {
          tags: ['Órdenes de compra'],
          summary: 'Obtener orden de compra por ID',
          security: secured,
          parameters: idParam('ID de la orden'),
          responses: ok('Orden con detalles'),
        },
        put: {
          tags: ['Órdenes de compra'],
          summary: 'Actualizar orden de compra',
          security: secured,
          parameters: idParam('ID de la orden'),
          requestBody: body('UpdatePurchaseOrder'),
          responses: ok('Orden actualizada'),
        },
      },
      '/purchase-orders/{id}/approve': {
        post: {
          tags: ['Órdenes de compra'],
          summary: 'Aprobar orden de compra',
          security: secured,
          parameters: idParam('ID de la orden'),
          responses: ok('Orden aprobada'),
        },
      },
      '/purchase-orders/{id}/cancel': {
        post: {
          tags: ['Órdenes de compra'],
          summary: 'Cancelar orden de compra',
          security: secured,
          parameters: idParam('ID de la orden'),
          requestBody: body('CancelPurchaseOrder'),
          responses: ok('Orden cancelada'),
        },
      },
      '/purchase-orders/{id}/receive': {
        post: {
          tags: ['Órdenes de compra'],
          summary: 'Recibir mercancía e ingresar al inventario',
          security: secured,
          parameters: idParam('ID de la orden'),
          requestBody: body('ReceiveMerchandise'),
          responses: ok('Mercancía recibida, inventario actualizado'),
        },
      },

      // ── Pagos a proveedores ──────────────────────────────────────────────────
      '/supplier-payments': {
        get: {
          tags: ['Pagos a proveedores'],
          summary: 'Listar pagos a proveedores',
          security: secured,
          parameters: [
            qp('supplier_id', 'integer'),
            qp('from', 'string'),
            qp('to', 'string'),
          ],
          responses: ok('Lista de pagos'),
        },
        post: {
          tags: ['Pagos a proveedores'],
          summary: 'Registrar pago a proveedor',
          security: secured,
          requestBody: body('CreateSupplierPayment'),
          responses: created('Pago registrado'),
        },
      },
      '/supplier-payments/{id}': {
        get: {
          tags: ['Pagos a proveedores'],
          summary: 'Obtener pago por ID',
          security: secured,
          parameters: idParam('ID del pago'),
          responses: ok('Datos del pago con asignaciones'),
        },
        put: {
          tags: ['Pagos a proveedores'],
          summary: 'Actualizar pago a proveedor',
          security: secured,
          parameters: idParam('ID del pago'),
          requestBody: body('UpdateSupplierPayment'),
          responses: ok('Pago actualizado'),
        },
        delete: {
          tags: ['Pagos a proveedores'],
          summary: 'Eliminar pago',
          security: secured,
          parameters: idParam('ID del pago'),
          responses: ok('Pago eliminado'),
        },
      },
      '/supplier-payments/{id}/cancel': {
        post: {
          tags: ['Pagos a proveedores'],
          summary: 'Cancelar pago a proveedor',
          security: secured,
          parameters: idParam('ID del pago'),
          requestBody: body('CancelSupplierPayment'),
          responses: ok('Pago cancelado'),
        },
      },

      // ── Entregas ─────────────────────────────────────────────────────────────
      '/deliveries': {
        get: {
          tags: ['Entregas'],
          summary: 'Listar entregas',
          security: secured,
          parameters: [
            qp('status', 'string', 'pending | in_transit | delivered | cancelled'),
            qp('customer_id', 'integer'),
          ],
          responses: ok('Lista de entregas'),
        },
        post: {
          tags: ['Entregas'],
          summary: 'Crear entrega',
          security: secured,
          requestBody: body('CreateDelivery'),
          responses: created('Entrega creada'),
        },
      },
      '/deliveries/{id}': {
        get: {
          tags: ['Entregas'],
          summary: 'Obtener entrega por ID',
          security: secured,
          parameters: idParam('ID de la entrega'),
          responses: ok('Datos de la entrega'),
        },
        put: {
          tags: ['Entregas'],
          summary: 'Actualizar entrega',
          security: secured,
          parameters: idParam('ID de la entrega'),
          requestBody: body('UpdateDelivery'),
          responses: ok('Entrega actualizada'),
        },
      },
      '/deliveries/{id}/in-transit': {
        post: {
          tags: ['Entregas'],
          summary: 'Marcar entrega en tránsito',
          security: secured,
          parameters: idParam('ID de la entrega'),
          responses: ok('Estado actualizado a en tránsito'),
        },
      },
      '/deliveries/{id}/confirm': {
        post: {
          tags: ['Entregas'],
          summary: 'Confirmar entrega al cliente',
          security: secured,
          parameters: idParam('ID de la entrega'),
          requestBody: body('ConfirmDelivery'),
          responses: ok('Entrega confirmada'),
        },
      },
      '/deliveries/{id}/cancel': {
        post: {
          tags: ['Entregas'],
          summary: 'Cancelar entrega',
          security: secured,
          parameters: idParam('ID de la entrega'),
          requestBody: body('CancelDelivery'),
          responses: ok('Entrega cancelada'),
        },
      },

      // ── Notas de crédito ─────────────────────────────────────────────────────
      '/credit-notes': {
        get: {
          tags: ['Notas de crédito'],
          summary: 'Listar notas de crédito',
          security: secured,
          parameters: [
            qp('status', 'string', 'pending | approved | cancelled'),
            qp('customer_id', 'integer'),
          ],
          responses: ok('Lista de notas de crédito'),
        },
        post: {
          tags: ['Notas de crédito'],
          summary: 'Crear nota de crédito (devolución)',
          security: secured,
          requestBody: body('CreateCreditNote'),
          responses: created('Nota de crédito creada'),
        },
      },
      '/credit-notes/{id}': {
        get: {
          tags: ['Notas de crédito'],
          summary: 'Obtener nota de crédito por ID',
          security: secured,
          parameters: idParam('ID de la nota'),
          responses: ok('Datos de la nota de crédito'),
        },
      },
      '/credit-notes/{id}/approve': {
        post: {
          tags: ['Notas de crédito'],
          summary: 'Aprobar nota de crédito y reintegrar stock',
          security: secured,
          parameters: idParam('ID de la nota'),
          responses: ok('Nota aprobada, stock reintegrado'),
        },
      },
      '/credit-notes/{id}/cancel': {
        post: {
          tags: ['Notas de crédito'],
          summary: 'Cancelar nota de crédito',
          security: secured,
          parameters: idParam('ID de la nota'),
          requestBody: body('CancelCreditNote'),
          responses: ok('Nota cancelada'),
        },
      },

      // ── Pre-pedidos ──────────────────────────────────────────────────────────
      '/pre-orders': {
        get: {
          tags: ['Pre-pedidos'],
          summary: 'Listar pre-pedidos',
          security: secured,
          parameters: [
            qp('status', 'string', 'pending | approved | rejected | converted'),
            qp('customer_id', 'integer'),
          ],
          responses: ok('Lista de pre-pedidos'),
        },
        post: {
          tags: ['Pre-pedidos'],
          summary: 'Crear pre-pedido (desde bot o manualmente)',
          security: secured,
          requestBody: body('CreatePreOrder'),
          responses: created('Pre-pedido creado'),
        },
      },
      '/pre-orders/{id}': {
        get: {
          tags: ['Pre-pedidos'],
          summary: 'Obtener pre-pedido por ID',
          security: secured,
          parameters: idParam('ID del pre-pedido'),
          responses: ok('Datos del pre-pedido'),
        },
      },
      '/pre-orders/{id}/approve': {
        post: {
          tags: ['Pre-pedidos'],
          summary: 'Aprobar pre-pedido',
          security: secured,
          parameters: idParam('ID del pre-pedido'),
          responses: ok('Pre-pedido aprobado'),
        },
      },
      '/pre-orders/{id}/reject': {
        post: {
          tags: ['Pre-pedidos'],
          summary: 'Rechazar pre-pedido',
          security: secured,
          parameters: idParam('ID del pre-pedido'),
          responses: ok('Pre-pedido rechazado'),
        },
      },
      '/pre-orders/{id}/convert': {
        post: {
          tags: ['Pre-pedidos'],
          summary: 'Convertir pre-pedido a venta',
          security: secured,
          parameters: idParam('ID del pre-pedido'),
          requestBody: body('ConvertPreOrder'),
          responses: created('Venta creada'),
        },
      },

      // ── POS (Reservas de inventario) ─────────────────────────────────────────
      '/pos/reservations': {
        get: {
          tags: ['POS'],
          summary: 'Ver reservas activas de inventario por sesión',
          security: secured,
          parameters: [
            qp('session_id', 'string'),
            qp('tab_id', 'string'),
          ],
          responses: ok('Reservas activas'),
        },
      },
      '/pos/reserve': {
        post: {
          tags: ['POS'],
          summary: 'Crear reserva de unidades para una pestaña del POS',
          security: secured,
          requestBody: body('CreateReservation'),
          responses: created('Reserva creada'),
        },
        patch: {
          tags: ['POS'],
          summary: 'Actualizar cantidad reservada en una pestaña',
          security: secured,
          requestBody: body('UpdateReservation'),
          responses: ok('Reserva actualizada'),
        },
      },
      '/pos/tab': {
        delete: {
          tags: ['POS'],
          summary: 'Liberar todas las reservas de una pestaña',
          security: secured,
          parameters: [
            qp('session_id', 'string', 'ID de sesión'),
            qp('tab_id', 'string', 'ID de pestaña'),
          ],
          responses: ok('Reservas liberadas'),
        },
      },
      '/pos/cleanup-expired': {
        post: {
          tags: ['POS'],
          summary: 'Limpiar reservas expiradas manualmente',
          security: secured,
          requestBody: body('CleanupExpired'),
          responses: ok('Reservas expiradas eliminadas'),
        },
      },

      // ── Cuentas por cobrar ───────────────────────────────────────────────────
      '/accounts-receivable': {
        get: {
          tags: ['Cuentas por cobrar'],
          summary: 'Balance de cuentas por cobrar por cliente',
          security: secured,
          parameters: [
            qp('customer_id', 'integer'),
            qp('from', 'string'),
            qp('to', 'string'),
          ],
          responses: ok('Resumen de deuda por cliente'),
        },
      },
      '/accounts-receivable/payments': {
        get: {
          tags: ['Cuentas por cobrar'],
          summary: 'Historial de abonos recibidos',
          security: secured,
          parameters: [
            qp('customer_id', 'integer'),
            qp('from', 'string'),
            qp('to', 'string'),
          ],
          responses: ok('Lista de abonos'),
        },
      },
      '/accounts-receivable/payments/{paymentId}/reverse': {
        post: {
          tags: ['Cuentas por cobrar'],
          summary: 'Revertir un abono registrado',
          security: secured,
          parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: body('ReversePayment'),
          responses: ok('Abono revertido'),
        },
      },
      '/accounts-receivable/admin-pin': {
        get: {
          tags: ['Cuentas por cobrar'],
          summary: 'Verificar si el PIN de admin está configurado',
          security: secured,
          responses: ok('Estado del PIN de admin'),
        },
        put: {
          tags: ['Cuentas por cobrar'],
          summary: 'Actualizar PIN de admin AR',
          security: secured,
          requestBody: body('UpdateAr'),
          responses: ok('PIN actualizado'),
        },
      },
      '/accounts-receivable/admin-pin/validate': {
        post: {
          tags: ['Cuentas por cobrar'],
          summary: 'Validar PIN de admin AR',
          security: secured,
          requestBody: body('ValidateAdminPin'),
          responses: ok('PIN válido o inválido'),
        },
      },

      // ── Audit log ────────────────────────────────────────────────────────────
      '/audit-logs': {
        get: {
          tags: ['Audit log'],
          summary: 'Historial de operaciones auditadas (cancelaciones, precios, usuarios)',
          security: secured,
          parameters: [
            qp('table', 'string', 'Tabla: sales, exchange_rates, users, products, product_presentations'),
            qp('action', 'string', 'CREATE | UPDATE | DELETE | CANCEL'),
            qp('userId', 'integer', 'ID del usuario que realizó la acción'),
            qp('recordId', 'integer', 'ID del registro afectado'),
            qp('from', 'string', 'Fecha inicio (ISO 8601)'),
            qp('to', 'string', 'Fecha fin (ISO 8601)'),
            qp('page', 'integer', 'Página (default: 1)'),
            qp('limit', 'integer', 'Resultados por página (max: 200, default: 50)'),
          ],
          responses: ok('Entradas de audit log paginadas con old_values y new_values'),
        },
      },
    },
  };
}
