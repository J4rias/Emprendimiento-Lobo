#!/usr/bin/env node
/**
 * POS Concurrency System - End-to-End Test Suite
 * Tests real-time inventory reservation, multi-tab support, and FIFO conflict resolution
 */

const axios = require('axios');
const io = require('socket.io-client');

const API_URL = 'http://localhost:5000/api';
const WS_URL = 'http://localhost:5000';
const TEST_PRODUCT_ID = 1;
const TEST_PRESENTATION_ID = 1;
const TEST_USER_ID = 1;
const TEST_WAREHOUSE_ID = 1;

// Test data
let results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper to log test results
function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) console.log(`   └─ ${details}`);
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

// Test 1: Verify pos_reservations table exists
async function testTableExists() {
  try {
    const response = await axios.get(`${API_URL}/pos/reservations`, {
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });
    logTest('Database: pos_reservations table exists', response.status === 200);
  } catch (err) {
    logTest('Database: pos_reservations table exists', false, err.message);
  }
}

// Test 2: Create first reservation (Session A, Tab 1)
async function testCreateReservation() {
  try {
    const response = await axios.post(`${API_URL}/pos/reserve`, {
      session_id: 'session-a',
      tab_id: 'tab-1',
      user_id: TEST_USER_ID,
      product_id: TEST_PRODUCT_ID,
      presentation_id: TEST_PRESENTATION_ID,
      units_requested: 5.00
    }, {
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });

    logTest(
      'Reservation: Create reservation (Session A, Tab 1)',
      response.status === 200 && response.data.reserved === 5,
      `Reserved: ${response.data.reserved} units, Available after: ${response.data.available_after}`
    );
    return response.data;
  } catch (err) {
    logTest('Reservation: Create reservation', false, err.response?.data?.message || err.message);
  }
}

// Test 3: Verify stock visibility (Session B should see reduced stock)
async function testStockVisibility(firstReservation) {
  try {
    const response = await axios.get(`${API_URL}/pos/reservations`, {
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });

    const reservations = response.data;
    const productReserved = reservations.find(r => r.product_id === TEST_PRODUCT_ID);

    logTest(
      'Stock Visibility: Other session sees reduced stock',
      productReserved && productReserved.total_reserved === 5,
      `Total reserved: ${productReserved?.total_reserved || 0} units`
    );
  } catch (err) {
    logTest('Stock Visibility: Other session sees reduced stock', false, err.message);
  }
}

// Test 4: Attempt to reserve more than available (should get 409)
async function testConflictDetection() {
  try {
    // Get current inventory
    const inventoryResp = await axios.get(`${API_URL}/products/${TEST_PRODUCT_ID}`, {
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });

    const totalStock = inventoryResp.data.inventory?.[0]?.quantity || 15;
    const alreadyReserved = 5; // From previous test
    const available = totalStock - alreadyReserved;
    const requestMore = available + 10; // Request more than available

    try {
      await axios.post(`${API_URL}/pos/reserve`, {
        session_id: 'session-b',
        tab_id: 'tab-1',
        user_id: TEST_USER_ID,
        product_id: TEST_PRODUCT_ID,
        presentation_id: TEST_PRESENTATION_ID,
        units_requested: requestMore
      }, {
        headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
      });

      logTest('Conflict Detection: 409 on insufficient stock', false, 'Should have returned 409');
    } catch (err) {
      const isConflict = err.response?.status === 409;
      const hasDetails = err.response?.data?.conflict === true;

      logTest(
        'Conflict Detection: 409 on insufficient stock',
        isConflict && hasDetails,
        isConflict
          ? `Status: ${err.response.status}, Available: ${err.response.data.available}, Requested: ${err.response.data.requested}`
          : `Expected 409, got ${err.response?.status}`
      );
    }
  } catch (err) {
    logTest('Conflict Detection: 409 on insufficient stock', false, err.message);
  }
}

// Test 5: Release partial reservation
async function testReleasePartial() {
  try {
    const response = await axios.patch(`${API_URL}/pos/reserve`, {
      session_id: 'session-a',
      tab_id: 'tab-1',
      product_id: TEST_PRODUCT_ID,
      presentation_id: TEST_PRESENTATION_ID,
      units_to_release: 3
    }, {
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });

    logTest(
      'Release: Partial release (3 units)',
      response.status === 200 && response.data.units_reserved === 2,
      `Remaining reserved: ${response.data.units_reserved} units`
    );
  } catch (err) {
    logTest('Release: Partial release', false, err.message);
  }
}

// Test 6: Release entire tab
async function testReleaseTab() {
  try {
    const response = await axios.delete(`${API_URL}/pos/tab`, {
      data: {
        session_id: 'session-a',
        tab_id: 'tab-1'
      },
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });

    logTest(
      'Release: Release entire tab',
      response.status === 200 && response.data.released_count >= 0,
      `Released ${response.data.released_count} reservations`
    );
  } catch (err) {
    logTest('Release: Release entire tab', false, err.message);
  }
}

// Test 7: Multi-tab support (same session, two tabs)
async function testMultiTab() {
  try {
    const tab1 = await axios.post(`${API_URL}/pos/reserve`, {
      session_id: 'session-c',
      tab_id: 'tab-1',
      user_id: TEST_USER_ID,
      product_id: TEST_PRODUCT_ID,
      presentation_id: TEST_PRESENTATION_ID,
      units_requested: 3.00
    }, {
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });

    const tab2 = await axios.post(`${API_URL}/pos/reserve`, {
      session_id: 'session-c',
      tab_id: 'tab-2',
      user_id: TEST_USER_ID,
      product_id: TEST_PRODUCT_ID,
      presentation_id: TEST_PRESENTATION_ID,
      units_requested: 4.00
    }, {
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });

    logTest(
      'Multi-Tab: Same session can reserve in multiple tabs',
      tab1.status === 200 && tab2.status === 200,
      `Tab 1 reserved: ${tab1.data.reserved}, Tab 2 reserved: ${tab2.data.reserved}`
    );

    // Verify they don't conflict with each other
    const reservations = await axios.get(`${API_URL}/pos/reservations`, {
      headers: { Authorization: `Bearer ${process.env.TEST_TOKEN || 'test-token'}` }
    });

    const totalByProduct = reservations
      .filter(r => r.product_id === TEST_PRODUCT_ID)
      .reduce((sum, r) => sum + parseFloat(r.total_reserved || 0), 0);

    logTest(
      'Multi-Tab: Internal tabs don\'t affect each other',
      totalByProduct === 7,
      `Total reserved globally: ${totalByProduct} (own tabs excluded from calculation)`
    );
  } catch (err) {
    logTest('Multi-Tab: Same session can reserve in multiple tabs', false, err.message);
  }
}

// Test 8: WebSocket integration
async function testWebSocketIntegration() {
  return new Promise((resolve) => {
    const socket = io(WS_URL, {
      auth: { token: process.env.TEST_TOKEN || 'test-token' },
      transports: ['websocket']
    });

    let reservationInitReceived = false;
    let reservationChangedReceived = false;
    let timeout = setTimeout(() => {
      socket.disconnect();
      logTest(
        'WebSocket: Connection and event listening',
        reservationInitReceived || reservationChangedReceived,
        'Did not receive expected WebSocket events within timeout'
      );
      resolve();
    }, 3000);

    socket.on('connect', () => {
      socket.emit('pos:join', {
        session_id: 'test-ws-session',
        tab_id: 'test-ws-tab'
      });
    });

    socket.on('reservations:init', (data) => {
      reservationInitReceived = true;
    });

    socket.on('reservation:changed', (data) => {
      reservationChangedReceived = true;
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      logTest('WebSocket: Connection and event listening', false, `Connection error: ${err.message}`);
      socket.disconnect();
      resolve();
    });

    // Give it 2.5 seconds to receive events
    setTimeout(() => {
      clearTimeout(timeout);
      socket.disconnect();
      logTest(
        'WebSocket: Connection and event listening',
        reservationInitReceived || reservationChangedReceived,
        reservationInitReceived ? 'Received reservations:init' : 'Waiting for events...'
      );
      resolve();
    }, 2500);
  });
}

// Main test runner
async function runAllTests() {
  console.log('\n========================================');
  console.log('🧪 POS Concurrency System Test Suite');
  console.log('========================================\n');

  try {
    console.log('1️⃣  Testing database setup...');
    await testTableExists();

    console.log('\n2️⃣  Testing reservation creation...');
    const firstRes = await testCreateReservation();

    console.log('\n3️⃣  Testing stock visibility across sessions...');
    if (firstRes) await testStockVisibility(firstRes);

    console.log('\n4️⃣  Testing conflict detection (FIFO)...');
    await testConflictDetection();

    console.log('\n5️⃣  Testing partial release...');
    await testReleasePartial();

    console.log('\n6️⃣  Testing tab cleanup...');
    await testReleaseTab();

    console.log('\n7️⃣  Testing multi-tab support...');
    await testMultiTab();

    console.log('\n8️⃣  Testing WebSocket integration...');
    await testWebSocketIntegration();

    console.log('\n========================================');
    console.log(`📊 Test Results: ${results.passed} passed, ${results.failed} failed`);
    console.log('========================================\n');

    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

runAllTests();
