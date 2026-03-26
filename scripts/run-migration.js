// Script wrapper pour charger .env.local avant d'exécuter la migration
require('dotenv').config({ path: '.env.local' });
require('./migrate-to-warehouse-quantities.js');
