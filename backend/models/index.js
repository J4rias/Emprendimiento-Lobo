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
const Quote = require('./Quote');
const QuoteDetail = require('./QuoteDetail');
const Sale = require('./Sale');
const SaleDetail = require('./SaleDetail');
const SalePayment = require('./SalePayment');

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

// Product - User (Created/Updated by)
Product.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Product.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// Product - ProductPresentation (One to Many)
Product.hasMany(ProductPresentation, { foreignKey: 'product_id', as: 'presentations' });
ProductPresentation.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

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

// Customer - PriceList (Many to One)
Customer.belongsTo(PriceList, { foreignKey: 'priceListId', as: 'priceList' });
PriceList.hasMany(Customer, { foreignKey: 'priceListId', as: 'customers' });

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
  Quote,
  QuoteDetail,
  Sale,
  SaleDetail,
  SalePayment
};
