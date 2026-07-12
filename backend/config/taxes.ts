export = {
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
  calculateIVA: function(amount: any) {
    return (amount * this.iva.rate) / 100;
  },

  calculateRetentionIVA: function(ivaAmount: any) {
    return (ivaAmount * this.retention.iva.rate) / 100;
  },

  calculateRetentionISLR: function(amount: any) {
    return (amount * this.retention.islr.rate) / 100;
  }
};
