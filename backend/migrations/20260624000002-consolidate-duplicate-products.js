'use strict';

/**
 * Data migration: consolidate 41 duplicate products
 *
 * Products were created multiple times because the create endpoint
 * had no name-uniqueness check. Old copies (is_active=0, stock=0)
 * are merged into the active copy by reassigning all FK references
 * (sale_details, credit_note_details, purchase_order_details,
 * inventory_movements, barcodes, price_list_details) and then
 * deleting the old products and their presentations.
 *
 * Presentations with matching units_per_package are reassigned;
 * presentations with different pack sizes are moved to the
 * surviving product to preserve historical sale data.
 */
module.exports = {
  async up(queryInterface) {
    const OLD_PRODUCT_IDS = [
      206, 826, 17, 16, 639, 25, 552, 1040, 1041, 217, 218, 42, 883,
      110, 601, 813, 814, 675, 664, 890, 891, 801, 1170, 84, 976,
      247, 116, 193, 1015, 1014, 132, 961, 584, 523, 991, 808, 1034,
      807, 184, 527, 148, 525
    ];
    const oldIds = OLD_PRODUCT_IDS.join(',');

    const REASSIGNED_PP_IDS = [
      222, 652, 33, 32, 41, 374, 866, 867, 58, 709, 126, 425,
      639, 640, 501, 489, 716, 717, 627, 996, 100, 802,
      132, 148, 787, 336, 817, 634, 860, 200, 344, 164
    ];
    const reassignedPpIds = REASSIGNED_PP_IDS.join(',');

    // All queries in a single transaction
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // ── PASO 1: Reasignar sale_details.presentation_id (CON match) ──
      const sdPresentationMap = [
        [502, 222], [968, 652], [929, 33], [1003, 32], [896, 41],
        [977, 374], [943, 866], [944, 867], [834, 58], [782, 709],
        [955, 126], [1014, 425], [927, 639], [928, 640], [963, 501],
        [950, 489], [997, 716], [991, 717], [990, 627], [990, 996],
        [1020, 100], [930, 802], [961, 132], [1015, 148], [969, 787],
        [941, 336], [971, 817], [992, 634], [940, 860], [815, 200],
        [819, 344], [828, 164]
      ];
      for (const [newPp, oldPp] of sdPresentationMap) {
        await q(`UPDATE sale_details SET presentation_id = ${newPp} WHERE presentation_id = ${oldPp}`);
      }

      // ── PASO 2: Reasignar sale_details.product_id ──
      const productMap = [
        [676, 206], [1142, 826], [1103, 17], [1176, 16], [1062, 639],
        [1070, 25], [1151, 552], [1117, 1040], [1118, 1041], [1106, 217],
        [1107, 218], [1008, 42], [956, 883], [1129, 110], [1188, 601],
        [1101, 813], [1102, 814], [1137, 675], [1124, 664], [1171, 890],
        [1165, 891], [1164, 801], [1164, 1170], [1194, 84], [1104, 976],
        [1120, 247], [1135, 116], [1155, 193], [1155, 1015], [1154, 1014],
        [1189, 132], [1143, 961], [1139, 584], [1115, 523], [1145, 991],
        [1166, 808], [1114, 1034], [1163, 807], [989, 184], [993, 527],
        [1002, 148], [973, 525]
      ];
      for (const [newProd, oldProd] of productMap) {
        await q(`UPDATE sale_details SET product_id = ${newProd} WHERE product_id = ${oldProd}`);
      }

      // ── PASO 3: Reasignar credit_note_details ──
      for (const [newPp, oldPp] of [[1020, 100], [955, 126], [1015, 148], [930, 802], [990, 996]]) {
        await q(`UPDATE credit_note_details SET presentation_id = ${newPp} WHERE presentation_id = ${oldPp}`);
      }
      for (const [newProd, oldProd] of [[1194, 84], [1129, 110], [1189, 132], [1104, 976], [1164, 1170]]) {
        await q(`UPDATE credit_note_details SET product_id = ${newProd} WHERE product_id = ${oldProd}`);
      }

      // ── PASO 4: Reasignar purchase_order_details ──
      for (const [newPp, oldPp] of [[1020, 100], [961, 132], [1015, 148], [828, 164], [1014, 425]]) {
        await q(`UPDATE purchase_order_details SET presentation_id = ${newPp} WHERE presentation_id = ${oldPp}`);
      }
      for (const [newProd, oldProd] of [[1194, 84], [1135, 116], [1189, 132], [1002, 148], [1188, 601]]) {
        await q(`UPDATE purchase_order_details SET product_id = ${newProd} WHERE product_id = ${oldProd}`);
      }

      // ── PASO 5: Reasignar inventory_movements ──
      const imPresentationMap = [
        [502, 676, 222], [929, 1103, 33], [977, 1151, 374], [834, 1008, 58],
        [955, 1129, 126], [927, 1101, 639], [928, 1102, 640], [950, 1124, 489],
        [997, 1171, 716], [991, 1165, 717], [990, 1164, 627], [990, 1164, 996],
        [1020, 1194, 100], [930, 1104, 802], [961, 1135, 132], [1015, 1189, 148],
        [969, 1143, 787], [941, 1115, 336], [992, 1166, 634], [940, 1114, 860],
        [815, 989, 200], [819, 993, 344], [828, 1002, 164]
      ];
      for (const [newPp, newProd, oldPp] of imPresentationMap) {
        await q(`UPDATE inventory_movements SET presentation_id = ${newPp}, product_id = ${newProd} WHERE presentation_id = ${oldPp}`);
      }
      // Presentations without match — only update product_id
      for (const [newProd, oldPp] of [[1106, 387], [1107, 386], [1120, 263], [1155, 209], [1155, 841], [1154, 840], [1163, 633]]) {
        await q(`UPDATE inventory_movements SET product_id = ${newProd} WHERE presentation_id = ${oldPp}`);
      }
      // Catch-all for remaining inventory_movements by product_id
      for (const [newProd, oldProd] of productMap) {
        await q(`UPDATE inventory_movements SET product_id = ${newProd} WHERE product_id = ${oldProd}`);
      }

      // ── PASO 6: Mover barcodes al producto nuevo ──
      for (const [newProd, oldProd] of productMap) {
        await q(`UPDATE barcodes SET product_id = ${newProd} WHERE product_id = ${oldProd}`);
      }

      // ── PASO 7: Mover presentaciones SIN match al producto nuevo ──
      const movePresentations = [
        [1106, 387], [1107, 386], [1120, 263], [1155, 209],
        [1155, 841], [1154, 840], [1139, 408], [1163, 633], [973, 342]
      ];
      for (const [newProd, ppId] of movePresentations) {
        await q(`UPDATE product_presentations SET product_id = ${newProd} WHERE id = ${ppId}`);
      }

      // ── PASO 8: Eliminar price_list_details de presentaciones reasignadas ──
      await q(`DELETE FROM price_list_details WHERE presentation_id IN (${reassignedPpIds})`);

      // ── PASO 9: Eliminar presentaciones reasignadas ──
      await q(`DELETE FROM product_presentations WHERE id IN (${reassignedPpIds})`);

      // ── PASO 10: Limpiar datos restantes y eliminar productos viejos ──
      await q(`DELETE FROM inventory WHERE product_id IN (${oldIds})`);
      await q(`DELETE FROM price_list_details WHERE product_id IN (${oldIds})`);
      await q(`DELETE FROM inventory_movements WHERE product_id IN (${oldIds})`);
      await q(`DELETE FROM product_presentations WHERE product_id IN (${oldIds})`);
      await q(`DELETE FROM products WHERE id IN (${oldIds})`);
    });
  },

  async down() {
    // Irreversible data migration — restore from backup if needed
    console.log('This migration is not reversible. Restore from a database backup.');
  }
};
