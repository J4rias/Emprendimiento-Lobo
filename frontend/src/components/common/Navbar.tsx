import { useState, useEffect } from 'react'
import { List, SignOut, User, Gear } from '@phosphor-icons/react'
import { Sun, Moon } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useCompany } from '../../context/CompanyContext'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps): React.JSX.Element => {
  const { user, logout } = useAuth()
  const { companyName } = useCompany()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [theme, setTheme] = useState(
    () => localStorage.getItem('atlas-theme') || 'light'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('atlas-theme', next)
    setTheme(next)
  }

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onMenuClick}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 lg:hidden"
              >
                <List className="h-6 w-6" />
              </button>
              <div className="flex-shrink-0 flex items-center ml-4 lg:ml-0">
                <h1 className="text-xl font-bold text-primary-600">
                  {companyName}
                </h1>
              </div>
            </div>

            <div className="flex items-center">
              <div className="ml-4 flex items-center md:ml-6 space-x-2">
                <div className="flex items-center text-sm">
                  <User className="h-5 w-5 text-gray-400 mr-2" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-gray-500 text-xs">{user?.role?.name}</p>
                  </div>
                </div>

                {/* Toggle dark/light mode */}
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                  aria-label="Cambiar tema"
                >
                  {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                <button
                  className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  title="Configuración"
                >
                  <Gear className="h-5 w-5" />
                </button>

                <button
                  onClick={() => setConfirmLogout(true)}
                  className="p-2 rounded-md text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Cerrar sesión"
                >
                  <SignOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={logout}
        title="¿Cerrar sesión?"
        description="Se cerrará tu sesión activa en el sistema."
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        variant="warning"
      />
    </>
  )
}

export default Navbar
