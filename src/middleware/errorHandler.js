const errorHandler = (err, req, res, next) => {
  console.error("🚨 Error:", err.stack);

  // Mongoose bad ObjectId error
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Geçersiz ID formatı",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  // Prisma errors
  if (err.code === "P2002") {
    return res.status(400).json({
      success: false,
      message: "Bu veri zaten mevcut",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "Kayıt bulunamadı",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Geçersiz token",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token süresi doldu",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    return res.status(400).json({
      success: false,
      message: "Validation hatası",
      error: message,
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Sunucu hatası oluştu",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = errorHandler;
