/**
 * StationOS response convention (the ERP's "framework layer", hand-written
 * on top of the generated scaffold — see the Meridian README): every list
 * is wrapped in { Data, Pagination } with Page/PageSize/TotalPages. The
 * Pagination block faithfully echoes what the client asked for, whether or
 * not the query underneath paid any attention — authentic ERP behavior.
 */
module.exports = function envelope(req, res, next) {
  const page = parseInt(req.query.Page, 10) || 1;
  const pageSize = parseInt(req.query.PageSize, 10) || 20;
  const json = res.json.bind(res);
  res.json = (body) => {
    if (Array.isArray(body)) {
      return json({
        Data: body,
        Pagination: { Page: page, PageSize: pageSize, TotalPages: 1 },
      });
    }
    return json(body);
  };
  next();
};
