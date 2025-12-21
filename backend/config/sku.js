module.exports = {
  format: '{PREFIX}-{CATEGORY}-{SEQUENCE}',
  prefix: 'VIV',
  sequenceLength: 4,
  startFrom: 1,

  // Función para generar SKU
  generate: function(categoryCode, sequence) {
    const paddedSequence = String(sequence).padStart(this.sequenceLength, '0');
    return `${this.prefix}-${categoryCode}-${paddedSequence}`;
  }
};
