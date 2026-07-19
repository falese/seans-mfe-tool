/**
 * Harbormaster response convention (the "API team's framework layer",
 * hand-written on top of the generated scaffold — see the Meridian README):
 * list endpoints return bare JSON arrays with the total row count in an
 * X-Total-Count header. That's how this system shipped fifteen years ago
 * and nobody is going to change it now.
 */
module.exports = function envelope(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (Array.isArray(body)) {
      res.set('X-Total-Count', String(body.length));
    }
    return json(body);
  };
  next();
};
