import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { Eye, EyeSlash, WarningCircle, ArrowRight } from '@phosphor-icons/react';

const LoginPage = () => {
  const navigate  = useNavigate();
  const { login } = useAuth();
  const { companyName } = useCompany();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(formData.username, formData.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Credenciales incorrectas. Verifique e intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo — branding ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900 flex-col justify-between p-12">

        {/* Fondo geométrico sutil */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/10" />
          <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-blue-500/10" />
          <div className="absolute -bottom-20 left-1/4 w-64 h-64 rounded-full bg-indigo-600/10" />
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 ring-1 ring-white/20 flex-shrink-0">
              <img src="/logo-atlas.jpeg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">{companyName}</span>
          </div>
        </div>

        {/* Tagline central */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-2">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Sistema ERP</p>
            <h1 className="text-white text-4xl font-bold leading-tight">
              Control total de<br />tu distribuidora
            </h1>
          </div>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Gestión de inventario, ventas, cuentas por cobrar y reportes multi-moneda en una sola plataforma.
          </p>

        </div>

        {/* Footer branding */}
        <div className="relative z-10">
          <p className="text-slate-600 text-xs">© {new Date().getFullYear()} {companyName}. Todos los derechos reservados.</p>
        </div>
      </div>

      {/* ── Panel derecho — formulario ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md space-y-8">

          {/* Mobile logo (solo visible en móvil) */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-gray-200 flex-shrink-0">
              <img src="/logo-atlas.jpeg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-gray-900 font-bold text-xl">{companyName}</span>
          </div>

          {/* Encabezado */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-gray-900">Bienvenido de vuelta</h2>
            <p className="text-sm text-gray-500">Ingresa tus credenciales para acceder al sistema</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <WarningCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Ingresa tu usuario"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400
                           text-sm outline-none transition
                           focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                           hover:border-gray-300"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Ingresa tu contraseña"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400
                             text-sm outline-none transition
                             focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                             hover:border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !formData.username || !formData.password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                         bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                         text-white text-sm font-semibold
                         transition-all duration-150
                         focus:outline-none focus:ring-2 focus:ring-primary-200 focus:ring-offset-2
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600
                         shadow-sm hover:shadow-md"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400">
            Acceso restringido al personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
