import { useState, useEffect, useCallback } from 'react';
import { HandCoins, MagnifyingGlass, CaretDown, CaretRight, FileText } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button, Card, DateRangeFilter, Select, Spinner } from '../components/ui';
import { getDefaultDateRange } from '../components/ui/DateRangeFilter';
import { saleService } from '../services/api/saleService';
import { userService } from '../services/api/userService';
import { formatCOP, formatDateShort } from '../utils/formatUtils';
import { downloadCSV } from '../utils/csvUtils';

interface VendedorRow {
  user_id: number;
  full_name: string;
  sale_count: number;
  total_commission_cop: number;
}

interface DetailRow {
  user_id: number;
  full_name: string;
  product_id: number;
  product_name: string;
  sale_count: number;
  units_sold: number;
  packages_sold: number;
  total_commission_cop: number;
}

interface CommissionsResponse {
  data: {
    period: { from: string; to: string };
    currency: string;
    summary: { total_commission_cop: number; vendedor_count: number };
    by_vendedor: VendedorRow[];
    detail: DetailRow[];
  };
}

interface UserOption {
  id: number;
  name: string;
}

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <Card variant="compact">
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
  </Card>
);

const CommissionsPage = () => {
  const [filters, setFilters] = useState<{ start_date: string; end_date: string; user_id: string }>({
    ...getDefaultDateRange(),
    user_id: ''
  });

  const [vendedores, setVendedores] = useState<UserOption[]>([]);
  const [rows, setRows] = useState<VendedorRow[]>([]);
  const [summary, setSummary] = useState<CommissionsResponse['data']['summary'] | null>(null);
  const [period, setPeriod] = useState<CommissionsResponse['data']['period'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  const [detailFor, setDetailFor] = useState<number | null>(null);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Carga siempre los usuarios con rol Vendedor (aunque no tengan ventas en el rango)
  useEffect(() => {
    userService.getActive().then((res) => {
      const users: UserOption[] = (res?.data || [])
        .filter((u) => {
          const roleName = (u as { role?: { name?: string } }).role?.name || '';
          return roleName.toLowerCase() === 'vendedor';
        })
        .map((u) => ({ id: u.id, name: u.name }));
      setVendedores(users);
    }).catch(() => {
      toast.error('Error al cargar los vendedores');
    });
  }, []);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setDetailFor(null);
    setDetailRows([]);
    try {
      const params: Record<string, string> = {
        from: filters.start_date,
        to: filters.end_date
      };
      if (filters.user_id) params.user_id = filters.user_id;

      const res: CommissionsResponse = await saleService.getCommissions(params);
      setRows(res.data?.by_vendedor || []);
      setSummary(res.data?.summary || null);
      setPeriod(res.data?.period || null);

      // Fusiona vendedores del reporte (quienes vendieron, aunque no tengan rol Vendedor)
      setVendedores((prev) => {
        const merged = new Map<number, UserOption>(prev.map((v) => [v.id, v]));
        (res.data?.by_vendedor || []).forEach((v) => merged.set(v.user_id, { id: v.user_id, name: v.full_name }));
        return Array.from(merged.values());
      });
    } catch (e) {
      console.error('Error obteniendo comisiones:', e);
      toast.error('Error al obtener las comisiones');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleToggleDetail = useCallback(async (user_id: number) => {
    if (detailFor === user_id) {
      setDetailFor(null);
      setDetailRows([]);
      return;
    }
    setDetailFor(user_id);
    setDetailLoading(true);
    try {
      const res: CommissionsResponse = await saleService.getCommissions({
        from: filters.start_date,
        to: filters.end_date,
        user_id: String(user_id),
        detail: 'true'
      });
      setDetailRows(res.data?.detail || []);
    } catch (e) {
      console.error('Error obteniendo detalle de comisiones:', e);
      toast.error('Error al obtener el detalle');
    } finally {
      setDetailLoading(false);
    }
  }, [detailFor, filters.start_date, filters.end_date]);

  const exportToCSV = () => {
    if (!rows.length) return;
    setExportingCSV(true);
    try {
      const headers = ['Vendedor', 'Ventas', 'Comisión COP'];
      const data = rows.map((r) => [r.full_name, r.sale_count, r.total_commission_cop]);
      downloadCSV(`comisiones-${filters.start_date}-a-${filters.end_date}`, headers, data);
    } catch (e) {
      console.error('Error exportando comisiones:', e);
      toast.error('Error al exportar CSV');
    } finally {
      setExportingCSV(false);
    }
  };

  const vendedorName = (id: number) =>
    vendedores.find((v) => v.id === id)?.name || rows.find((r) => r.user_id === id)?.full_name || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Comisiones</h1>
        <p className="text-gray-600 mt-1">Comisiones acumuladas por vendedor según el rango de fechas</p>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <HandCoins className="w-3.5 h-3.5 inline mr-1" />
              Vendedor
            </label>
            <Select
              value={filters.user_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, user_id: e.target.value }))}
              options={[
                { value: '', label: 'Todos los vendedores' },
                ...vendedores.map((v) => ({ value: v.id, label: v.name }))
              ]}
            />
          </div>

          <DateRangeFilter
            startDate={filters.start_date}
            endDate={filters.end_date}
            onChange={({ start_date, end_date }) =>
              setFilters((prev) => ({ ...prev, start_date, end_date }))
            }
            showPresets
          />
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
          <Button loading={loading} onClick={handleSearch} disabled={loading}>
            <MagnifyingGlass className="w-4 h-4" />
            {loading ? 'Consultando...' : 'Consultar'}
          </Button>
          {rows.length > 0 && (
            <Button variant="secondary" size="icon" loading={exportingCSV} onClick={exportToCSV} disabled={exportingCSV} title="Exportar CSV">
              <FileText className="w-4 h-4 text-emerald-600" />
            </Button>
          )}
        </div>
      </Card>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Comisiones" value={formatCOP(summary.total_commission_cop)} />
          <StatCard label="Vendedores" value={summary.vendedor_count} />
          <StatCard label="Periodo" value={period ? `${formatDateShort(period.from)} → ${formatDateShort(period.to)}` : '—'} />
        </div>
      )}

      {/* Tabla por vendedor */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : rows.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendedor</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ventas</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Comisión COP</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Detalle</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row) => {
                  const open = detailFor === row.user_id;
                  return (
                    <>
                      <tr key={row.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">{row.sale_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                          {formatCOP(row.total_commission_cop)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleDetail(row.user_id)}>
                            {open ? <CaretDown className="w-4 h-4" /> : <CaretRight className="w-4 h-4" />}
                          </Button>
                        </td>
                      </tr>
                      {open && (
                        <tr key={`detail-${row.user_id}`}>
                          <td colSpan={4} className="px-6 py-4 bg-gray-50">
                            {detailLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Spinner size="sm" />
                              </div>
                            ) : detailRows.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ventas</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unidades</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Paquetes</th>
                                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Comisión COP</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {detailRows.map((d) => (
                                      <tr key={d.product_id}>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{d.product_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500">{d.sale_count}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500">{d.units_sold}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-500">{d.packages_sold}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                                          {formatCOP(d.total_commission_cop)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-4 text-sm text-gray-500">
                                Sin comisiones para {vendedorName(row.user_id)}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !loading && summary === null && (
          <div className="text-center py-12 text-gray-500">Selecciona un rango de fechas y presiona Consultar</div>
        )
      )}
    </div>
  );
};

export default CommissionsPage;
