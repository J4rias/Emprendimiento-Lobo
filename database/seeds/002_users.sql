-- Seed: Usuarios Iniciales
-- Created: 2025-01-20
-- NOTA: Las contraseñas deben ser hasheadas antes de insertar
-- Contraseña por defecto para todos: Admin123!

-- Usuario Administrador
-- Contraseña: Admin123!
-- Hash bcrypt (10 rounds): $2b$10$YourHashedPasswordHere
INSERT INTO users (username, email, password, first_name, last_name, phone, role_id, is_active) VALUES
('admin', 'admin@viveres.com', '$2b$10$YourHashedPasswordHere', 'Admin', 'Sistema', NULL, 1, TRUE);

-- NOTA: En producción, el hash debe generarse con:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('Admin123!', 10);

-- Para crear el primer usuario admin, ejecutar desde el código:
-- npm run seed:admin

-- O usar el siguiente comando Node.js:
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('Admin123!', 10).then(h => console.log(h));"
