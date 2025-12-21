module.exports = {
  iva: {
    rate: 16.00,  // 16% IVA
    applies: 'all'
  },
  retention: {
    iva: {
      rate: 75.00,  // 75% retención IVA
      minimumAmount: 1000
    },
    islr: {
      rate: 3.00,   // 3% retención ISLR
      minimumAmount: 5000
    }
  },

  // Funciones de cálculo
  calculateIVA: function(amount) {
    return (amount * this.iva.rate) / 100;
  },

  calculateRetentionIVA: function(ivaAmount) {
    return (ivaAmount * this.retention.iva.rate) / 100;
  },

  calculateRetentionISLR: function(amount) {
    return (amount * this.retention.islr.rate) / 100;
  }
};
