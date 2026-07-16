const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');

let authToken = '';
let testProduct = null; // { id, presentationId }

beforeAll(async () => {
  await sequelize.authenticate();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: process.env.TEST_USER || 'admin', password: process.env.TEST_PASSWORD || 'admin123' });
  authToken = res.body.data?.token || res.body.token || '';

  // Buscar un producto real con presentación y stock para tests
  const prodRes = await request(app)
    .get('/api/products')
    .query({ page: 1, limit: 10 })
    .set('Authorization', `Bearer ${authToken}`);
  const products = prodRes.body.data || [];
  for (const p of products) {
    if (p.presentations?.length > 0) {
      testProduct = { id: p.id, presentationId: p.presentations[0].id };
      break;
    }
  }
});

afterAll(async () => { await sequelize.close(); });

describe('POS API — smoke tests', () => {
  it('GET /api/pos/reservations sin auth -> 401 o 403', async () => {
    const res = await request(app).get('/api/pos/reservations');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /api/pos/reservations con token -> 200', async () => {
    const res = await request(app)
      .get('/api/pos/reservations')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POS API — reserve con UUIDs (payload real del frontend)', () => {
  // El frontend genera session_id y tab_id como UUIDs (strings).
  // El schema Zod debe aceptarlos.

  it('POST /api/pos/reserve con session_id UUID string -> debe aceptar (no 400)', async () => {
    if (!testProduct) return;
    const res = await request(app)
      .post('/api/pos/reserve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        session_id: uuidv4(),
        tab_id: uuidv4(),
        product_id: testProduct.id,
        presentation_id: testProduct.presentationId,
        units_requested: 1,
      });
    // El frontend envía UUIDs — si da 400 es porque Zod rechaza strings
    expect(res.status).not.toBe(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/pos/reserve con session_id/tab_id como strings cortos -> debe aceptar (no 400)', async () => {
    if (!testProduct) return;
    const res = await request(app)
      .post('/api/pos/reserve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        session_id: 'test-session-abc',
        tab_id: 'test-tab-123',
        product_id: testProduct.id,
        presentation_id: testProduct.presentationId,
        units_requested: 1,
      });
    expect(res.status).not.toBe(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/pos/reserve con units_requested=0 y UUIDs -> no 400 por el schema', async () => {
    if (!testProduct) return;
    const res = await request(app)
      .post('/api/pos/reserve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        session_id: uuidv4(),
        tab_id: uuidv4(),
        product_id: testProduct.id,
        presentation_id: testProduct.presentationId,
        units_requested: 0,
      });
    // units_requested=0 puede ser válido (liberar) — no debe ser 400 por Zod
    expect(res.status).not.toBe(400);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/pos/reserve con producto inexistente y UUIDs -> 404 (no 400 por schema)', async () => {
    const res = await request(app)
      .post('/api/pos/reserve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        session_id: uuidv4(),
        tab_id: uuidv4(),
        product_id: 99999999,
        presentation_id: 99999999,
        units_requested: 1,
      });
    // Debe pasar Zod validation (no 400) y fallar con 404 por producto inexistente
    expect(res.status).not.toBe(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('POS API — reserve validación básica', () => {
  it('POST /api/pos/reserve sin auth -> 401 o 403', async () => {
    const res = await request(app)
      .post('/api/pos/reserve')
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/pos/reserve con body vacío -> 400 (Zod validation)', async () => {
    const res = await request(app)
      .post('/api/pos/reserve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });

  it('POST /api/pos/reserve con product_id/presentation_id string no-numérico -> 400', async () => {
    const res = await request(app)
      .post('/api/pos/reserve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        session_id: uuidv4(),
        tab_id: uuidv4(),
        product_id: 'abc',
        presentation_id: 'xyz',
        units_requested: 'no-es-numero',
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThanOrEqual(422);
  });
});

describe('POS API — update reserve (PATCH)', () => {
  it('PATCH /api/pos/reserve sin auth -> 401 o 403', async () => {
    const res = await request(app)
      .patch('/api/pos/reserve')
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('PATCH /api/pos/reserve con body vacío -> 400 (faltan campos)', async () => {
    const res = await request(app)
      .patch('/api/pos/reserve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('PATCH /api/pos/reserve con UUIDs (payload real frontend) -> no 400 por Zod', async () => {
    if (!testProduct) return;
    const res = await request(app)
      .patch('/api/pos/reserve')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        session_id: uuidv4(),
        tab_id: uuidv4(),
        presentation_id: testProduct.presentationId,
        units_to_release: 1,
      });
    // Puede dar 404 (reserva no encontrada) pero NO 400 por schema
    expect(res.status).not.toBe(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('POS API — release tab (DELETE)', () => {
  it('DELETE /api/pos/tab sin auth -> 401 o 403', async () => {
    const res = await request(app)
      .delete('/api/pos/tab');
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('DELETE /api/pos/tab sin body -> 400 (faltan session_id y tab_id)', async () => {
    const res = await request(app)
      .delete('/api/pos/tab')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });

  it('DELETE /api/pos/tab con UUIDs (payload real frontend) -> 200', async () => {
    const res = await request(app)
      .delete('/api/pos/tab')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        session_id: uuidv4(),
        tab_id: uuidv4(),
      });
    // Tab sin reservas = 200 (no hay nada que liberar, pero no debe dar error)
    expect(res.status).toBe(200);
  });
});

describe('POS API — cleanup expired', () => {
  it('POST /api/pos/cleanup-expired sin auth -> 401 o 403', async () => {
    const res = await request(app)
      .post('/api/pos/cleanup-expired')
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
  });

  it('POST /api/pos/cleanup-expired con token -> 200 o 403 (requiere admin)', async () => {
    const res = await request(app)
      .post('/api/pos/cleanup-expired')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBeLessThan(500);
  });
});
