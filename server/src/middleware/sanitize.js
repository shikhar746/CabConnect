/**
 * Strips keys starting with "$" or containing "." from request bodies/params to
 * block MongoDB operator injection (e.g. {"email": {"$gt": ""}}).
 */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !k.startsWith('$') && !k.includes('.')).map(([k, v]) => [k, clean(v)]));
  }
  return value;
}

module.exports = (req, _res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (key.startsWith('$') || typeof req.query[key] === 'object') delete req.query[key];
    }
  }
  next();
};
