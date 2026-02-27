require('dotenv').config();

const constants = {
    ALGOLIA_APP_ID: process.env.ALGOLIA_APP_ID || '',
    ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY || '',
    ALGOLIA_INDEX: process.env.ALGOLIA_INDEX || 'uat_catalog_replica',

    QR_OUTPUT_DIR: process.env.QR_OUTPUT_DIR || './output',
    QR_DEFAULT_FORMAT: process.env.QR_DEFAULT_FORMAT || 'png',
    QR_CONCURRENCY: parseInt(process.env.QR_CONCURRENCY, 10) || 8,

    JTV_PRODUCT_BASE_URL: process.env.JTV_PRODUCT_BASE_URL || 'https://www.jtv.com/product'
};

module.exports = constants;
