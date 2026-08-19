/**
 * Contrato de la API que consume atlas-bot (~/Projects/atlas-bot).
 *
 * El bot autentica con X-API-Key y recibe los permisos de BOT_PERMISSIONS
 * (middleware/auth.ts). Estos tests fijan tres cosas que estaban rotas el
 * 2026-08-19: el alias /api/ar, el permiso de /price-lists/active, y que el
 * bot NO pueda escribir en cartera.
 */
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

const KEY = process.env.BOT_API_KEY;
const asBot = (req) => req.set('X-API-Key', KEY);

beforeAll(async () => { await sequelize.authenticate(); });
afterAll(async () => { await sequelize.close(); });

describe('atlas-bot — contrato de la API', () => {
  it('la API key está configurada en el entorno de test', () => {
    expect(KEY).toBeTruthy();
  });

  // ─── Rutas que el bot llama y que devolvían 404 ────────────────────────────
  it('GET /api/ar/summary responde (alias de /accounts-receivable)', async () => {
    const res = await asBot(request(app).get('/api/ar/summary'));
    expect(res.status).toBe(200);
  });

  it('GET /api/ar/customers responde', async () => {
    const res = await asBot(request(app).get('/api/ar/customers'));
    expect(res.status).toBe(200);
  });

  it('la ruta canónica /api/accounts-receivable/summary sigue viva', async () => {
    const res = await asBot(request(app).get('/api/accounts-receivable/summary'));
    expect(res.status).toBe(200);
  });

  // ─── Precios: devolvía 403 porque exigía sales.create ──────────────────────
  it('GET /api/price-lists/active funciona con price_lists.view del bot', async () => {
    const res = await asBot(request(app).get('/api/price-lists/active'));
    expect(res.status).toBe(200);
  });

  // ─── El bot lee, no escribe ────────────────────────────────────────────────
  it('el bot NO puede reversar un abono', async () => {
    const res = await asBot(request(app).post('/api/ar/payments/1/reverse')).send({ pin: '0000' });
    expect(res.status).toBe(403);
  });

  it('el bot NO puede cambiar el PIN de crédito', async () => {
    const res = await asBot(request(app).put('/api/ar/admin-pin')).send({ pin: '1234' });
    expect(res.status).toBe(403);
  });

  it('el bot NO puede validar el PIN de crédito (oráculo de fuerza bruta)', async () => {
    const res = await asBot(request(app).post('/api/ar/admin-pin/validate')).send({ pin: '1234' });
    expect(res.status).toBe(403);
  });

  it('el bot sí puede consultar el estado del PIN', async () => {
    const res = await asBot(request(app).get('/api/ar/admin-pin/status'));
    expect(res.status).toBe(200);
  });

  // ─── Resto de endpoints del contrato ───────────────────────────────────────
  it.each([
    '/api/categories',
    '/api/products',
    '/api/exchange-rates/latest',
    '/api/customers/activity',
    '/api/inventory/valuation',
    '/api/inventory/alerts/low-stock',
    '/api/pre-orders',
    '/api/pre-orders/stats',
    '/api/sales/summary',
    '/api/sales/stats',
    '/api/banks',
  ])('GET %s es accesible para el bot', async (path) => {
    const res = await asBot(request(app).get(path));
    expect(res.status).toBe(200);
  });

  it('sin API key válida no pasa nada', async () => {
    const res = await request(app).get('/api/products').set('X-API-Key', 'clave-incorrecta');
    expect(res.status).toBe(401);
  });
});
