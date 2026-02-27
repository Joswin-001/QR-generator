const BASE_SEARCH_URL = process.env.JTV_SEARCH_URL || 'https://www.jtv.com/search';

function buildCollectionUrl(skus) {
  if (!skus || skus.length === 0) {
    return BASE_SEARCH_URL;
  }
  const query = skus.map(s => encodeURIComponent(s)).join('+');
  return `${BASE_SEARCH_URL}#q=${query}&t=All`;
}

module.exports = { buildCollectionUrl };
