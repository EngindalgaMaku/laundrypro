const jwt = require("jsonwebtoken");
const { prisma } = require("../config/database");

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Erişim reddedildi. Token gerekli.",
        code: "TOKEN_REQUIRED",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
        isActive: true,
      },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Geçersiz token. Kullanıcı bulunamadı.",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.tenant.isActive) {
      return res.status(403).json({
        success: false,
        message: "Tenant hesabı aktif değil.",
        code: "TENANT_INACTIVE",
      });
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        domain: user.tenant.domain,
      },
    };

    // Set tenant ID for tenant middleware
    req.tenantId = user.tenantId;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Geçersiz token",
        code: "INVALID_TOKEN",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token süresi dolmuş",
        code: "TOKEN_EXPIRED",
      });
    }

    res.status(500).json({
      success: false,
      message: "Authentication hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication gerekli",
        code: "AUTH_REQUIRED",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için yetkiniz bulunmuyor",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }

    next();
  };
};

module.exports = { auth, authorize };
