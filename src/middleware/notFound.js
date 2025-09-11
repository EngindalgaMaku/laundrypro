const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint bulunamadı: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
};

module.exports = notFound;
