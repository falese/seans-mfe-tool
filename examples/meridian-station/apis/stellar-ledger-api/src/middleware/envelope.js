/**
 * StellarLedger response convention (the vendor's "framework layer",
 * hand-written on top of the generated scaffold — see the Meridian README):
 * every list is wrapped in { result, meta } with cursor pagination fields.
 * The demo dataset fits in one page, so the cursor is always null — the
 * envelope is the contract, not a promise the backend keeps.
 */
module.exports = function envelope(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (Array.isArray(body)) {
      return json({ result: body, meta: { cursor: null, hasMore: false } });
    }
    return json(body);
  };
  next();
};
