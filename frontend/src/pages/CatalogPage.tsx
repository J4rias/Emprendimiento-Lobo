import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MagnifyingGlass, CaretUp, Fire, Sparkle, Package } from '@phosphor-icons/react';
import { catalogService, type CatalogData, type CatalogProduct } from '../services/api/catalogService';
import { formatUSD } from '../utils/formatUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = API_URL.replace(/\/api$/, '');

// Category emoji mapping
const CATEGORY_ICONS = {
  'Aceites': '🫒', 'Animales': '🐾', 'Arroces': '🍚', 'Atunes': '🐟',
  'Azucares': '🍬', 'Bebidas': '🥤', 'Cafes': '☕', 'Cereales': '🥣',
  'Chocolates': '🍫', 'Chucherias': '🍭', 'Comestible': '🍽️', 'Compotas': '🍎',
  'Confiteria': '🧁', 'Enlatados': '🥫', 'Galletas': '🍪', 'Granos': '🫘',
  'Harinas': '🌾', 'Higiene': '🧴', 'Ketchups': '🍅', 'Lacteos': '🥛',
  'Limpieza': '🧹', 'Margarinas': '🧈', 'Mayonesas': '🥚', 'Pastas': '🍝',
  'Sales': '🧂', 'Salsas': '🫙', 'Sardinas': '🐠', 'Vinagres': '🫗',
};

const CatalogPage = () => {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    catalogService.get()
      .then(res => { setData(res.data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 600);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data?.products) return [];
    if (!search.trim()) return data.products;
    const q = search.toLowerCase().trim();
    return data.products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category_name.toLowerCase().includes(q) ||
      (p.packaging && p.packaging.toLowerCase().includes(q))
    );
  }, [data, search]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<number, { name: string; products: CatalogProduct[] }> = {};
    filtered.forEach(p => {
      if (!groups[p.category_id]) groups[p.category_id] = { name: p.category_name, products: [] };
      groups[p.category_id].products.push(p);
    });
    return Object.entries(groups).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [filtered]);

  const scrollToCategory = (catId: number) => {
    const el = categoryRefs.current[catId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCategory(catId);
  };

  const scrollToTop = () => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const topProductsList = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.products.map(p => [p.id, p]));
    return (data.topProducts || []).map(id => map.get(id)).filter((p): p is CatalogProduct => !!p);
  }, [data]);

  const newArrivalsList = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.products.map(p => [p.id, p]));
    return (data.newArrivals || []).map(id => map.get(id)).filter((p): p is CatalogProduct => !!p);
  }, [data]);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} />;
  if (!data) return null;

  const isSearching = search.trim().length > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Sticky Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 py-2.5 flex items-center gap-3">
          <img src="/logo-atlas.jpeg" alt="Logo" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-800 truncate leading-tight">
              {data.company?.name || 'Catálogo'}
            </h1>
            <p className="text-[10px] text-slate-400 leading-tight">Catálogo de Precios</p>
          </div>
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-full bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary-200 focus:border-transparent outline-none transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        {!isSearching && (
          <div ref={pillsRef} className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={scrollToTop}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${!activeCategory ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Todos
            </button>
            {data.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${activeCategory === cat.id ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {CATEGORY_ICONS[cat.name as keyof typeof CATEGORY_ICONS] || '📦'} {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main ref={contentRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-7xl mx-auto px-3 py-4 space-y-6">

          {/* MagnifyingGlass Results */}
          {isSearching ? (
            <section>
              <p className="text-sm text-gray-500 mb-3">
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{search}"
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {filtered.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No se encontraron productos</p>
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Top Products */}
              {topProductsList.length > 0 && (
                <section>
                  <SectionTitle icon={<Fire className="w-4 h-4 text-orange-500" />} title="Productos Top" />
                  <HorizontalScroll products={topProductsList} />
                </section>
              )}

              {/* New Arrivals */}
              {newArrivalsList.length > 0 && (
                <section>
                  <SectionTitle icon={<Sparkle className="w-4 h-4 text-emerald-500" />} title="Recién Llegados" />
                  <HorizontalScroll products={newArrivalsList} />
                </section>
              )}

              {/* Products by Category */}
              {groupedByCategory.map(([catId, group]) => {
                const g = group as { name: string; products: CatalogProduct[] };
                return (
                <section key={catId} ref={el => categoryRefs.current[catId] = el} className="scroll-mt-28">
                  <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-gray-200">
                    <span className="text-xl">{CATEGORY_ICONS[g.name as keyof typeof CATEGORY_ICONS] || '📦'}</span>
                    <h2 className="text-base font-bold text-slate-800">{g.name}</h2>
                    <span className="text-xs text-gray-400 ml-auto">{g.products.length} productos</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {g.products.map(p => <ProductCard key={p.id} product={p} />)}
                  </div>
                </section>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-slate-800 text-white mt-8">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <img src="/logo-atlas.jpeg" alt="Logo" className="w-14 h-14 rounded-full object-cover" />
              <div className="text-center sm:text-left">
                <p className="font-bold text-sm">{data.company?.name}</p>
                {data.company?.tax_id && <p className="text-xs text-slate-400">RIF: {data.company.tax_id}</p>}
                {data.company?.address && <p className="text-xs text-slate-400">{data.company.address}</p>}
                {data.company?.phone && <p className="text-xs text-slate-400">Tel: {data.company.phone}</p>}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700 text-center">
            </div>
          </div>
        </footer>
      </main>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-5 right-5 z-50 bg-slate-800 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center hover:bg-slate-700 transition-colors"
        >
          <CaretUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

// ===== Sub-components =====

const ProductCard = ({ product }: { product: CatalogProduct }) => (
  <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
    {/* Product image */}
    <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100">
      <img
        src={product.image_url ? `${API_BASE_URL}${product.image_url}` : '/images/placeholder-product.jpg'}
        alt={product.name}
        className="w-full h-full object-contain p-2"
        loading="lazy"
      />
      {product.low_stock ? (
        <span className="absolute top-1.5 right-1.5 text-[9px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
          Últimos disp.
        </span>
      ) : null}
    </div>

    {/* Product info */}
    <div className="px-3 pb-3 pt-1.5">
      <h3 className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2 min-h-[2rem]">
        {product.name}
      </h3>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {product.packaging ? `${product.packaging} X ${product.units_per_package}` : `X ${product.units_per_package} und`}
      </p>

      {/* Prices */}
      <div className="mt-2 pt-1.5 border-t border-gray-50">
        <p className="text-base font-bold text-slate-900 leading-none">
          {formatUSD(product.package_price)}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {formatUSD(product.unit_price)} c/u
        </p>
      </div>
    </div>
  </div>
);

const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-1.5 mb-2">
    {icon}
    <h2 className="text-sm font-bold text-slate-800">{title}</h2>
  </div>
);

const HorizontalScroll = ({ products }: { products: CatalogProduct[] }) => (
  <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
    {products.map(p => (
      <div key={p.id} className="flex-shrink-0 w-36 snap-start">
        <ProductCard product={p} />
      </div>
    ))}
  </div>
);

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
    <img src="/logo-atlas.jpeg" alt="Logo" className="w-20 h-20 rounded-full object-cover mb-4 animate-pulse" />
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
    <p className="mt-3 text-sm text-gray-500">Cargando catálogo...</p>
  </div>
);

const ErrorScreen = ({ error }: { error: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div className="text-center">
      <p className="text-4xl mb-3">😕</p>
      <p className="text-sm text-gray-600">No se pudo cargar el catálogo</p>
      <p className="text-xs text-gray-400 mt-1">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700"
      >
        Reintentar
      </button>
    </div>
  </div>
);

export default CatalogPage;
