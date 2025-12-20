function success(res, data = null, message = 'Success') {
  return res.json({
    success: true,
    message,
    ...(data && { data })
  });
}

function paginate(res, { items, total, page, limit }) {
  return res.json({
    success: true,
    data: items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
}

module.exports = {
  success,
  paginate
};