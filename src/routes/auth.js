const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { prisma } = require("../config/database");
const { auth } = require("../middleware/auth");

const router = express.Router();

// Generate JWT tokens
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "24h",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
  });

  return { accessToken, refreshToken };
};

// @route   POST /api/v1/auth/register
// @desc    Register new tenant and admin user
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { tenantName, domain, firstName, lastName, email, phone, password } =
      req.body;

    // Validate required fields
    if (!tenantName || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Gerekli alanları doldurun",
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Bu email adresi zaten kullanılıyor",
      });
    }

    // Check if domain already exists
    if (domain) {
      const existingTenant = await prisma.tenant.findUnique({
        where: { domain },
      });

      if (existingTenant) {
        return res.status(400).json({
          success: false,
          message: "Bu domain zaten kullanılıyor",
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create tenant and admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          domain: domain || null,
          settings: {
            currency: "TRY",
            timezone: "Europe/Istanbul",
            language: "tr",
          },
        },
      });

      // Create admin user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          phone: phone || null,
          password: hashedPassword,
          firstName,
          lastName,
          role: "ADMIN",
        },
      });

      return { tenant, user };
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(result.user);

    res.status(201).json({
      success: true,
      message: "Hesap başarıyla oluşturuldu",
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          domain: result.tenant.domain,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Hesap oluşturma hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post("/login", async (req, res) => {
  try {
    console.log("🔐 Login request received:", { 
      email: req.body.email, 
      tenantId: req.body.tenantId,
      hasPassword: !!req.body.password 
    });

    const { email, password, tenantId } = req.body;

    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({
        success: false,
        message: "Email ve şifre gerekli",
      });
    }

    // Find user with tenant info
    const whereClause = { email, isActive: true };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    console.log("🔍 Searching user with:", whereClause);

    const user = await prisma.user.findFirst({
      where: whereClause,
      include: {
        tenant: true,
      },
    });

    console.log("👤 User found:", user ? { id: user.id, email: user.email, tenantId: user.tenantId } : null);

    if (!user) {
      console.log("❌ User not found");
      return res.status(401).json({
        success: false,
        message: "Geçersiz email veya şifre",
      });
    }

    console.log("🏢 Tenant info:", { id: user.tenant.id, name: user.tenant.name, isActive: user.tenant.isActive });

    if (!user.tenant.isActive) {
      console.log("❌ Tenant not active");
      return res.status(403).json({
        success: false,
        message: "Tenant hesabı aktif değil",
      });
    }

    // Check password
    console.log("🔑 Checking password...");
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("🔑 Password match:", isMatch);

    if (!isMatch) {
      console.log("❌ Password mismatch");
      return res.status(401).json({
        success: false,
        message: "Geçersiz email veya şifre",
      });
    }

    // Update last login
    console.log("📝 Updating last login...");
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    console.log("🎫 Generating tokens...");
    const { accessToken, refreshToken } = generateTokens(user);

    console.log("✅ Login successful for user:", user.email);

    res.json({
      success: true,
      message: "Giriş başarılı",
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          domain: user.tenant.domain,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("❌ Login error details:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Giriş hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token gerekli",
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Geçersiz refresh token",
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    res.json({
      success: true,
      message: "Token yenilendi",
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({
      success: false,
      message: "Token yenileme hatası",
    });
  }
});

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", auth, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

// @route   POST /api/v1/auth/logout
// @desc    Logout user (token invalidation would be handled by client)
// @access  Private
router.post("/logout", auth, (req, res) => {
  res.json({
    success: true,
    message: "Başarıyla çıkış yapıldı",
  });
});

module.exports = router;
