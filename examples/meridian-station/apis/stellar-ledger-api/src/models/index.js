const mongoose = require('mongoose');

// Import all models
const Account = require('./Account.model');
const Charge = require('./Charge.model');
const Valuation = require('./Valuation.model');
const Settlement = require('./Settlement.model');
const Payroll = require('./Payroll.model');

// Export both singular and plural forms for each model
module.exports = {
  Account,
  Accounts: Account,
  Charge,
  Charges: Charge,
  Valuation,
  Valuations: Valuation,
  Settlement,
  Settlements: Settlement,
  Payroll,
  Payrolls: Payroll
};