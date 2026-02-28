const { sequelize } = require('../config/database');

// Import models
const User = require('./User');
const Role = require('./Role');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const Category = require('./Category');
const Product = require('./Product');
const ProductPresentation = require('./ProductPresentation');
const Barcode = require('./Barcode');
const Warehouse = require('./Warehouse');
const Inventory = require('./Inventory');
const Batch = require('./Batch');
const Transfer = require('./Transfer');
const TransferDetail = require('./TransferDetail');
const Customer = require('./Customer');
const PriceList = require('./PriceList');
const PriceListDetail = require('./PriceListDetail');
const Quote = require('./Quote');
const QuoteDetail = require('./QuoteDetail');
const Sale = require('./Sale');
const SaleDetail = require('./SaleDetail');
const SalePayment = require('./SalePayment');
const Supplier = require('./Supplier');
const SupplierContact = require('./SupplierContact');
const Brand = require('./Brand');
const ExchangeRate = require('./ExchangeRate');
const PackagingType = require('./PackagingType');
const PresentationType = require('./PresentationType');
const InventoryMovement = require('./InventoryMovement');
const PurchaseOrder = require('./PurchaseOrder');
const PurchaseOrderDetail = require('./PurchaseOrderDetail');
const SupplierPayment = require('./SupplierPayment');
const CreditNote = require('./CreditNote');
const CreditNoteDetail = require('./CreditNoteDetail');
const Delivery = require('./Delivery');
const DeliveryDetail = require('./DeliveryDetail');
const CompanySettings = require('./CompanySettings');

// Define associations

// User - Role (Many to One)
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

// Role - Permission (Many to Many through RolePermission)
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'permissions'
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'roles'
});

// Category - Self Reference (Parent-Child)
Category.belongsTo(Category, { foreignKey: 'parent_id', as: 'parent' });
Category.hasMany(Category, { foreignKey: 'parent_id', as: 'children' });

// Product - Category (Many to One)
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });

// Product - Brand (Many to One)
Product.belongsTo(Brand, { foreignKey: 'brand_id', as: 'brand' });
Brand.hasMany(Product, { foreignKey: 'brand_id', as: 'products' });

// Product - User (Created/Updated by)
Product.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Product.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// Product - ProductPresentation (One to Many)
Product.hasMany(ProductPresentation, { foreignKey: 'product_id', as: 'presentations' });
ProductPresentation.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// ProductPresentation - PackagingType (Many to One)
ProductPresentation.belongsTo(PackagingType, { foreignKey: 'packaging_type_id', as: 'packagingType' });
PackagingType.hasMany(ProductPresentation, { foreignKey: 'packaging_type_id', as: 'presentations' });

// ProductPresentation - PresentationType (Many to One)
ProductPresentation.belongsTo(PresentationType, { foreignKey: 'presentation_type_id', as: 'presentationType' });
PresentationType.hasMany(ProductPresentation, { foreignKey: 'presentation_type_id', as: 'presentations' });

// Product - Barcode (One to Many)
Product.hasMany(Barcode, { foreignKey: 'product_id', as: 'barcodes' });
Barcode.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// ProductPresentation - Barcode (One to Many)
ProductPresentation.hasMany(Barcode, { foreignKey: 'presentation_id', as: 'barcodes' });
Barcode.belongsTo(ProductPresentation, { foreignKey: 'presentation_id', as: 'presentation' });

// Warehouse - User (Manager)
Warehouse.belongsTo(User, { foreignKey: 'manager_id', as: 'manager' });

// Inventory - Product (Many to One)
Inventory.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(Inventory, { foreignKey: 'product_id', as: 'inventories' });

// Inventory - Warehouse (Many to One)
Inventory.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
Warehouse.hasMany(Inventory, { foreignKey: 'warehouse_id', as: 'inventories' });

// Batch - Product (Many to One)
Batch.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(Batch, { foreignKey: 'product_id', as: 'batches' });

// Batch - Warehouse (Many to One)
Batch.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
Warehouse.hasMany(Batch, { foreignKey: 'warehouse_id', as: 'batches' });

// Transfer - Warehouse (Origin and Destination)
Transfer.belongsTo(Warehouse, { foreignKey: 'origin_warehouse_id', as: 'originWarehouse' });
Transfer.belongsTo(Warehouse, { foreignKey: 'destination_warehouse_id', as: 'destinationWarehouse' });

// Transfer - User (Multiple roles)
Transfer.belongsTo(User, { foreignKey: 'requested_by', as: 'requester' });
Transfer.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
Transfer.belongsTo(User, { foreignKey: 'shipped_by', as: 'shipper' });
Transfer.belongsTo(User, { foreignKey: 'received_by', as: 'receiver' });

// Transfer - TransferDetail (One to Many)
Transfer.hasMany(TransferDetail, { foreignKey: 'transfer_id', as: 'details' });
TransferDetail.belongsTo(Transfer, { foreignKey: 'transfer_id', as: 'transfer' });

// TransferDetail - Product (Many to One)
TransferDetail.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(TransferDetail, { foreignKey: 'product_id', as: 'transferDetails' });

// TransferDetail - Batch (Many to One)
TransferDetail.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });
Batch.hasMany(TransferDetail, { foreignKey: 'batch_id', as: 'transferDetails' });

// TransferDetail - ProductPresentation (Many to One)
TransferDetail.belongsTo(ProductPresentation, { foreignKey: 'presentation_id', as: 'presentation' });
ProductPresentation.hasMany(TransferDetail, { foreignKey: 'presentation_id', as: 'transferDetails' });

// Customer - PriceList (Many to One)
Customer.belongsTo(PriceList, { foreignKey: 'priceListId', as: 'priceList' });
PriceList.hasMany(Customer, { foreignKey: 'priceListId', as: 'customers' });

// PriceList - User (Updated by)
PriceList.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// PriceList - PriceListDetail (One to Many)
PriceList.hasMany(PriceListDetail, { foreignKey: 'price_list_id', as: 'details' });
PriceListDetail.belongsTo(PriceList, { foreignKey: 'price_list_id', as: 'priceList' });

// PriceListDetail - Product (Many to One)
PriceListDetail.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(PriceListDetail, { foreignKey: 'product_id', as: 'priceListDetails' });

// PriceListDetail - ProductPresentation (Many to One)
PriceListDetail.belongsTo(ProductPresentation, { foreignKey: 'presentation_id', as: 'presentation' });
ProductPresentation.hasMany(PriceListDetail, { foreignKey: 'presentation_id', as: 'priceListDetails' });

// Quote - Customer (Many to One)
Quote.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Quote, { foreignKey: 'customerId', as: 'quotes' });

// Quote - PriceList (Many to One)
Quote.belongsTo(PriceList, { foreignKey: 'priceListId', as: 'priceList' });
PriceList.hasMany(Quote, { foreignKey: 'priceListId', as: 'quotes' });

// Quote - User (Many to One)
Quote.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Quote, { foreignKey: 'userId', as: 'quotes' });

// QuoteDetail - Quote (Many to One)
QuoteDetail.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote' });
Quote.hasMany(QuoteDetail, { foreignKey: 'quoteId', as: 'details' });

// QuoteDetail - Product (Many to One)
QuoteDetail.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(QuoteDetail, { foreignKey: 'productId', as: 'quoteDetails' });

// QuoteDetail - ProductPresentation (Many to One)
QuoteDetail.belongsTo(ProductPresentation, { foreignKey: 'productPresentationId', as: 'presentation' });
ProductPresentation.hasMany(QuoteDetail, { foreignKey: 'productPresentationId', as: 'quoteDetails' });

// Sale - Customer (Many to One)
Sale.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Sale, { foreignKey: 'customer_id', as: 'sales' });

// Sale - Warehouse (Many to One)
Sale.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
Warehouse.hasMany(Sale, { foreignKey: 'warehouse_id', as: 'sales' });

// Sale - User (Seller/Cashier)
Sale.belongsTo(User, { foreignKey: 'user_id', as: 'seller' });
User.hasMany(Sale, { foreignKey: 'user_id', as: 'sales' });

// Sale - User (Created/Updated by)
Sale.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Sale.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// Sale - Quote (Many to One)
Sale.belongsTo(Quote, { foreignKey: 'quote_id', as: 'quote' });
Quote.hasOne(Sale, { foreignKey: 'quote_id', as: 'sale' });

// SaleDetail - Sale (Many to One)
SaleDetail.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
Sale.hasMany(SaleDetail, { foreignKey: 'sale_id', as: 'details' });

// SaleDetail - Product (Many to One)
SaleDetail.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(SaleDetail, { foreignKey: 'product_id', as: 'saleDetails' });

// SaleDetail - ProductPresentation (Many to One)
SaleDetail.belongsTo(ProductPresentation, { foreignKey: 'presentation_id', as: 'presentation' });
ProductPresentation.hasMany(SaleDetail, { foreignKey: 'presentation_id', as: 'saleDetails' });

// SaleDetail - Batch (Many to One)
SaleDetail.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });
Batch.hasMany(SaleDetail, { foreignKey: 'batch_id', as: 'saleDetails' });

// SalePayment - Sale (Many to One)
SalePayment.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
Sale.hasMany(SalePayment, { foreignKey: 'sale_id', as: 'payments' });

// SalePayment - User (Created by)
SalePayment.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Supplier - SupplierContact (One to Many)
Supplier.hasMany(SupplierContact, { foreignKey: 'supplier_id', as: 'contacts' });
SupplierContact.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

// ExchangeRate - User (Created/Updated by)
ExchangeRate.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
ExchangeRate.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// InventoryMovement - Product (Many to One)
InventoryMovement.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(InventoryMovement, { foreignKey: 'product_id', as: 'movements' });

// InventoryMovement - Warehouse (Many to One)
InventoryMovement.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
Warehouse.hasMany(InventoryMovement, { foreignKey: 'warehouse_id', as: 'movements' });

// InventoryMovement - ProductPresentation (Many to One)
InventoryMovement.belongsTo(ProductPresentation, { foreignKey: 'presentation_id', as: 'presentation' });
ProductPresentation.hasMany(InventoryMovement, { foreignKey: 'presentation_id', as: 'movements' });

// InventoryMovement - User (Many to One)
InventoryMovement.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(InventoryMovement, { foreignKey: 'user_id', as: 'inventoryMovements' });

// InventoryMovement - Batch (Many to One)
InventoryMovement.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });
Batch.hasMany(InventoryMovement, { foreignKey: 'batch_id', as: 'movements' });

// PurchaseOrder - Supplier (Many to One)
PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
Supplier.hasMany(PurchaseOrder, { foreignKey: 'supplier_id', as: 'purchaseOrders' });

// PurchaseOrder - Warehouse (Many to One)
PurchaseOrder.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
Warehouse.hasMany(PurchaseOrder, { foreignKey: 'warehouse_id', as: 'purchaseOrders' });

// PurchaseOrder - User (Created/Updated/Approved by)
PurchaseOrder.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
PurchaseOrder.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });
PurchaseOrder.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// PurchaseOrder - PurchaseOrderDetail (One to Many)
PurchaseOrder.hasMany(PurchaseOrderDetail, { foreignKey: 'purchase_order_id', as: 'details' });
PurchaseOrderDetail.belongsTo(PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'purchaseOrder' });

// PurchaseOrderDetail - Product (Many to One)
PurchaseOrderDetail.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(PurchaseOrderDetail, { foreignKey: 'product_id', as: 'purchaseOrderDetails' });

// PurchaseOrderDetail - ProductPresentation (Many to One)
PurchaseOrderDetail.belongsTo(ProductPresentation, { foreignKey: 'presentation_id', as: 'presentation' });
ProductPresentation.hasMany(PurchaseOrderDetail, { foreignKey: 'presentation_id', as: 'purchaseOrderDetails' });

// SupplierPayment - Supplier (Many to One)
SupplierPayment.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
Supplier.hasMany(SupplierPayment, { foreignKey: 'supplier_id', as: 'payments' });

// SupplierPayment - PurchaseOrder (Many to One, optional)
SupplierPayment.belongsTo(PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'purchaseOrder' });
PurchaseOrder.hasMany(SupplierPayment, { foreignKey: 'purchase_order_id', as: 'payments' });

// SupplierPayment - User (Created by)
SupplierPayment.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(SupplierPayment, { foreignKey: 'created_by', as: 'supplierPayments' });

// CreditNote - Sale (Many to One)
CreditNote.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
Sale.hasMany(CreditNote, { foreignKey: 'sale_id', as: 'creditNotes' });

// CreditNote - Customer (Many to One)
CreditNote.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(CreditNote, { foreignKey: 'customer_id', as: 'creditNotes' });

// CreditNote - Warehouse (Many to One)
CreditNote.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
Warehouse.hasMany(CreditNote, { foreignKey: 'warehouse_id', as: 'creditNotes' });

// CreditNote - User (Created/Approved by)
CreditNote.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
CreditNote.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
User.hasMany(CreditNote, { foreignKey: 'created_by', as: 'createdCreditNotes' });

// CreditNote - CreditNoteDetail (One to Many)
CreditNote.hasMany(CreditNoteDetail, { foreignKey: 'credit_note_id', as: 'details' });
CreditNoteDetail.belongsTo(CreditNote, { foreignKey: 'credit_note_id', as: 'creditNote' });

// CreditNoteDetail - SaleDetail (Many to One)
CreditNoteDetail.belongsTo(SaleDetail, { foreignKey: 'sale_detail_id', as: 'saleDetail' });
SaleDetail.hasMany(CreditNoteDetail, { foreignKey: 'sale_detail_id', as: 'creditNoteDetails' });

// CreditNoteDetail - Product (Many to One)
CreditNoteDetail.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(CreditNoteDetail, { foreignKey: 'product_id', as: 'creditNoteDetails' });

// CreditNoteDetail - ProductPresentation (Many to One)
CreditNoteDetail.belongsTo(ProductPresentation, { foreignKey: 'presentation_id', as: 'presentation' });
ProductPresentation.hasMany(CreditNoteDetail, { foreignKey: 'presentation_id', as: 'creditNoteDetails' });

// CreditNoteDetail - Batch (Many to One)
CreditNoteDetail.belongsTo(Batch, { foreignKey: 'batch_id', as: 'batch' });
Batch.hasMany(CreditNoteDetail, { foreignKey: 'batch_id', as: 'creditNoteDetails' });

// Delivery - Sale (Many to One)
Delivery.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
Sale.hasMany(Delivery, { foreignKey: 'sale_id', as: 'deliveries' });

// Delivery - Customer (Many to One)
Delivery.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Delivery, { foreignKey: 'customer_id', as: 'deliveries' });

// Delivery - Warehouse (Many to One)
Delivery.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
Warehouse.hasMany(Delivery, { foreignKey: 'warehouse_id', as: 'deliveries' });

// Delivery - User (Delivered by and Created by)
Delivery.belongsTo(User, { foreignKey: 'delivered_by', as: 'deliverer' });
Delivery.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Delivery, { foreignKey: 'created_by', as: 'createdDeliveries' });

// Delivery - DeliveryDetail (One to Many)
Delivery.hasMany(DeliveryDetail, { foreignKey: 'delivery_id', as: 'details' });
DeliveryDetail.belongsTo(Delivery, { foreignKey: 'delivery_id', as: 'delivery' });

// DeliveryDetail - SaleDetail (Many to One)
DeliveryDetail.belongsTo(SaleDetail, { foreignKey: 'sale_detail_id', as: 'saleDetail' });
SaleDetail.hasMany(DeliveryDetail, { foreignKey: 'sale_detail_id', as: 'deliveryDetails' });

// DeliveryDetail - Product (Many to One)
DeliveryDetail.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(DeliveryDetail, { foreignKey: 'product_id', as: 'deliveryDetails' });

// DeliveryDetail - ProductPresentation (Many to One)
DeliveryDetail.belongsTo(ProductPresentation, { foreignKey: 'presentation_id', as: 'presentation' });
ProductPresentation.hasMany(DeliveryDetail, { foreignKey: 'presentation_id', as: 'deliveryDetails' });

// Export all models
module.exports = {
  sequelize,
  User,
  Role,
  Permission,
  RolePermission,
  Category,
  Product,
  ProductPresentation,
  Barcode,
  Warehouse,
  Inventory,
  Batch,
  Transfer,
  TransferDetail,
  Customer,
  PriceList,
  PriceListDetail,
  Quote,
  QuoteDetail,
  Sale,
  SaleDetail,
  SalePayment,
  Supplier,
  SupplierContact,
  Brand,
  ExchangeRate,
  PackagingType,
  PresentationType,
  InventoryMovement,
  PurchaseOrder,
  PurchaseOrderDetail,
  SupplierPayment,
  CreditNote,
  CreditNoteDetail,
  Delivery,
  DeliveryDetail,
  CompanySettings,
};
