import React from 'react';
import { Image as ImageIcon, Package } from '@phosphor-icons/react';
import { Badge, Card, Table, Pagination, ViewAction, EditAction, DeleteAction } from '../ui';
import type { Column } from '../ui';
import { formatMoney, LOCALE } from '../../utils/formatUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = API_URL.replace(/\/api$/, '');

interface Product {
  id: number;
  name: string;
  sku: string;
  image_url: string | null;
  is_active: boolean;
  updated_at: string | null;
  category?: {
    name: string;
    color?: string;
  } | null;
  [key: string]: unknown;
}

interface StockAndValue {
  bultos: number;
  unidades: number;
  unitsPerPackage: number;
  totalValueCOP: number;
}

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  calculateStockAndValue: (product: Product) => StockAndValue;
  hasPermission: (permission: string) => boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({
  products,
  loading,
  calculateStockAndValue,
  hasPermission,
  onView,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}) => {
  const hasActions = hasPermission('products.update') || hasPermission('products.delete');

  const baseColumns: Column<Product>[] = [
    {
      key: 'image',
      header: 'Imagen',
      render: (_: unknown, product: Product) =>
        product.image_url ? (
          <img
            src={`${API_BASE_URL}${product.image_url}`}
            alt={product.name}
            className="w-12 h-12 object-cover rounded shadow-sm border border-gray-100"
          />
        ) : (
          <div className="w-12 h-12 bg-gray-50 rounded flex items-center justify-center border border-gray-100">
            <ImageIcon className="h-6 w-6 text-gray-300" />
          </div>
        ),
    },
    {
      key: 'producto',
      header: 'Producto',
      render: (_: unknown, product: Product) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 leading-tight">{product.name}</span>
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter mt-0.5">
            {product.sku}
          </span>
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoría',
      render: (_: unknown, product: Product) =>
        product.category ? (
          <span
            className="px-2 py-0.5 text-[10px] rounded-md text-white font-bold uppercase tracking-wider"
            style={{ backgroundColor: product.category.color || '#6B7280' }}
          >
            {product.category.name}
          </span>
        ) : (
          <span className="px-2 py-0.5 text-[10px] rounded-md bg-gray-100 text-gray-400 uppercase font-bold">
            N/A
          </span>
        ),
    },
    {
      key: 'stock',
      header: 'Stock (Bultos / Unid)',
      className: 'text-center',
      cellClassName: 'text-center',
      render: (_: unknown, product: Product) => {
        const { bultos, unidades, unitsPerPackage } = calculateStockAndValue(product);
        return (
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-gray-800">
              {bultos}{' '}
              <span className="text-[10px] text-gray-500 font-normal uppercase">Bultos</span>
            </span>
            {unitsPerPackage > 1 && (
              <span className="text-[11px] text-gray-500 italic">
                + {unidades} <span className="text-[9px] uppercase">Unid</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (_: unknown, product: Product) => (
        <Badge variant={product.is_active ? 'success' : 'error'}>
          {product.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actualizado',
      header: 'Actualizado',
      className: 'text-center',
      cellClassName: 'text-center',
      render: (_: unknown, product: Product) =>
        product.updated_at ? (
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-gray-700 capitalize">
              {new Date(product.updated_at).toLocaleDateString(LOCALE, {
                day: '2-digit',
                month: 'short',
              })}
            </span>
            <span className="text-[10px] text-gray-400">
              {new Date(product.updated_at).toLocaleTimeString(LOCALE, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      key: 'valor',
      header: 'Valor Inventario (COP)',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (_: unknown, product: Product) => {
        const { totalValueCOP } = calculateStockAndValue(product);
        return (
          <span className="text-sm text-slate-900">
            {formatMoney(totalValueCOP, '$', 0)}
          </span>
        );
      },
    },
  ];

  const actionsColumn: Column<Product> = {
    key: 'acciones',
    header: 'Acciones',
    className: 'text-center',
    cellClassName: 'text-center',
    render: (_: unknown, product: Product) => (
      <div className="flex items-center justify-center gap-1">
        <ViewAction onClick={() => onView(product)} />
        {hasPermission('products.update') && product.is_active && (
          <EditAction onClick={() => onEdit(product)} />
        )}
        {hasPermission('products.delete') && product.is_active && (
          <DeleteAction onClick={() => onDelete(product.id)} />
        )}
      </div>
    ),
  };

  const columns = hasActions ? [...baseColumns, actionsColumn] : baseColumns;

  return (
    <Card variant="flat" className="overflow-hidden">
      <Table
        columns={columns}
        data={products}
        loading={loading}
        skeletonRows={8}
        emptyIcon={Package}
        emptyMessage="No se encontraron productos"
        emptyDescription="Ajusta los filtros o crea un nuevo producto"
      />
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </Card>
  );
};

export default ProductTable;
