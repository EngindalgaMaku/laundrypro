const jwt = require("jsonwebtoken");

const tenantMiddleware = async (req, res, next) => {
  try {
    // Get tenant ID from header
    let tenantId = req.headers["x-tenant-id"];

    // If no tenant ID in header, try to get from JWT token
    if (!tenantId) {
      const token = req.headers.authorization?.split(" ")[1];

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          tenantId = decoded.tenantId;
        } catch (jwtError) {
          // JWT is invalid, but we continue without setting tenant
          console.warn(
            "Invalid JWT token in tenant middleware:",
            jwtError.message
          );
        }
      }
    }

    // For public endpoints that don't require tenant
    const publicPaths = [
      "/auth/login",
      "/auth/register",
      "/auth/forgot-password",
    ];
    const isPublicPath = publicPaths.some((path) => req.path.includes(path));

    if (!tenantId && !isPublicPath) {
      return res.status(400).json({
        success: false,
        message:
          "Tenant ID gerekli. Lütfen x-tenant-id header'ını ekleyin veya giriş yapın.",
        code: "TENANT_REQUIRED",
      });
    }

    // Add tenant ID to request object
    req.tenantId = tenantId;

    // Add tenant filter function for database queries
    req.getTenantFilter = () => ({ tenantId: tenantId });

    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Tenant doğrulama hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = tenantMiddleware;
