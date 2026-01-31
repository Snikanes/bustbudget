const path = require('path');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.resolve(__dirname, '../../data/budget.db'),
  },
  production: {
    dialect: 'sqlite',
    storage: path.resolve(__dirname, '../../data/budget.db'),
  },
};
