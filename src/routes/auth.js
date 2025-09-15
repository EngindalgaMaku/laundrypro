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

// @route   POST /api/v1/:appSlug/auth/register
// @desc    Register new tenant and admin user for specific app
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { businessInfo, accountInfo, deviceInfo } = req.body;
    const appSlug = req.appSlug;
    const appConfig = req.appConfig;

    console.log(`📱 ${appConfig.name} kayıt isteği:`, {
      businessInfo: businessInfo?.name,
      email: accountInfo?.email,
      appSlug,
    });

    // Mobile app için yeni format kontrolü
    if (businessInfo && accountInfo) {
      const {
        name: tenantName,
        country,
        city,
        phone,
        email,
        businessTypeIds, // Changed from businessTypeId to businessTypeIds (array)
      } = businessInfo;
      const { username, password } = accountInfo;

      // Validate required fields
      if (!tenantName || !username || !password || !phone) {
        return res.status(400).json({
          success: false,
          message: "Gerekli alanları doldurun",
        });
      }

      // Use mobile format
      var finalTenantName = tenantName;
      var finalFirstName = username;
      var finalLastName = "";
      var finalEmail = email || `${username}@${appSlug}.local`; // Default email if not provided
      var finalPhone = phone;
      var finalPassword = password;
      var finalDomain = null;
      var finalBusinessTypeIds = businessTypeIds; // Array of business type IDs
    } else {
      // Backward compatibility - web format
      const {
        tenantName,
        domain,
        firstName,
        lastName,
        email,
        phone,
        password,
      } = req.body;

      // Validate required fields
      if (!tenantName || !firstName || !lastName || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Gerekli alanları doldurun",
        });
      }

      var finalTenantName = tenantName;
      var finalFirstName = firstName;
      var finalLastName = lastName;
      var finalEmail = email;
      var finalPhone = phone;
      var finalPassword = password;
      var finalDomain = domain;
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: finalEmail },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Bu email adresi zaten kullanılıyor",
      });
    }

    // Check if domain already exists
    if (finalDomain) {
      const existingTenant = await prisma.tenant.findUnique({
        where: { domain: finalDomain },
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
    const hashedPassword = await bcrypt.hash(finalPassword, salt);

    // Create tenant and admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Validate business types if provided
      let validatedBusinessTypes = [];
      if (
        finalBusinessTypeIds &&
        Array.isArray(finalBusinessTypeIds) &&
        finalBusinessTypeIds.length > 0
      ) {
        console.log("🔍 Validating business types:", finalBusinessTypeIds);

        const businessTypes = await tx.businessType.findMany({
          where: {
            id: { in: finalBusinessTypeIds },
            isActive: true,
          },
        });

        if (businessTypes.length !== finalBusinessTypeIds.length) {
          const foundIds = businessTypes.map((bt) => bt.id);
          const invalidIds = finalBusinessTypeIds.filter(
            (id) => !foundIds.includes(id)
          );
          throw new Error(
            `Geçersiz işletme türü seçimi: ${invalidIds.join(", ")}`
          );
        }

        validatedBusinessTypes = businessTypes;
        console.log(
          "✅ Business types validated:",
          businessTypes.map((bt) => bt.displayName).join(", ")
        );
      }

      // Create tenant with app-specific settings
      const tenantData = {
        name: finalTenantName,
        domain: finalDomain || null,
        type: appConfig.type, // App-specific type
        settings: {
          ...appConfig.defaultSettings,
          appSlug: appSlug,
          registrationInfo: {
            appType: appSlug,
            appName: appConfig.name,
            country: businessInfo?.country || "Türkiye",
            city: businessInfo?.city || null,
            deviceInfo: deviceInfo || null,
            businessTypes:
              validatedBusinessTypes.map((bt) => ({
                id: bt.id,
                name: bt.displayName,
              })) || null,
          },
        },
      };

      console.log("🏢 Creating tenant:", {
        name: tenantData.name,
        type: tenantData.type,
        appSlug,
        businessTypesCount: validatedBusinessTypes.length,
      });

      const tenant = await tx.tenant.create({
        data: tenantData,
      });

      // Create tenant-business type relationships
      if (validatedBusinessTypes.length > 0) {
        console.log("🔗 Creating tenant-business type relationships...");

        const tenantBusinessTypeData = validatedBusinessTypes.map(
          (businessType, index) => ({
            tenantId: tenant.id,
            businessTypeId: businessType.id,
            isPrimary: index === 0, // First selected business type is primary
            isActive: true,
          })
        );

        await tx.tenantBusinessType.createMany({
          data: tenantBusinessTypeData,
        });

        console.log(
          "✅ Created tenant-business type relationships:",
          validatedBusinessTypes.map((bt) => bt.displayName).join(", ")
        );
      }

      // Create user (normal user, not admin)
      const userData = {
        tenantId: tenant.id,
        email: finalEmail,
        phone: finalPhone || null,
        password: hashedPassword,
        firstName: finalFirstName,
        lastName: finalLastName,
        role: "USER",
      };

      console.log("👤 Creating user:", {
        email: userData.email,
        firstName: userData.firstName,
      });

      const user = await tx.user.create({
        data: userData,
      });

      return { tenant, user };
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(result.user);

    console.log(
      `✅ ${appConfig.name} için hesap oluşturuldu:`,
      result.user.email
    );

    res.status(201).json({
      success: true,
      message: `${appConfig.name} hesabınız başarıyla oluşturuldu`,
      data: {
        app: {
          slug: appSlug,
          name: appConfig.name,
          type: appConfig.type,
        },
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
          type: result.tenant.type,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    console.error(`❌ ${req.appConfig?.name || "App"} kayıt hatası:`, error);
    res.status(500).json({
      success: false,
      message: "Hesap oluşturma hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/:appSlug/auth/login
// @desc    Login user for specific app
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const appSlug = req.appSlug;
    const appConfig = req.appConfig;

    console.log(`🔐 ${appConfig.name} login request:`, {
      email: req.body.email,
      tenantId: req.body.tenantId,
      hasPassword: !!req.body.password,
      appSlug,
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

    console.log(
      "👤 User found:",
      user ? { id: user.id, email: user.email, tenantId: user.tenantId } : null
    );

    if (!user) {
      console.log("❌ User not found");
      return res.status(401).json({
        success: false,
        message: "Geçersiz email veya şifre",
      });
    }

    console.log("🏢 Tenant info:", {
      id: user.tenant.id,
      name: user.tenant.name,
      isActive: user.tenant.isActive,
    });

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

// @route   PUT /api/v1/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, email, phone } = req.body;

    console.log("🔄 Updating profile for user:", userId);
    console.log("📝 Update data:", { firstName, lastName, email, phone });
    console.log("📝 Current user email:", req.user.email);
    console.log("📝 New email:", email);

    // Check if email is being changed and if it's already in use
    if (email && email !== req.user.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Bu email adresi zaten kullanılıyor",
        });
      }
    }

    // Prepare update data - only include defined fields
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    console.log("📝 Final update data:", updateData);

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log("✅ Profile updated successfully");
    console.log("📊 Updated user data:", updatedUser);

    res.json({
      success: true,
      message: "Profil başarıyla güncellendi",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error("❌ Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Profil güncellenirken hata oluştu",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   PUT /api/v1/auth/change-password
// @desc    Change user password
// @access  Private
router.put("/change-password", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    console.log("🔄 Changing password for user:", userId);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Mevcut şifre ve yeni şifre gerekli",
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Mevcut şifre yanlış",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    console.log("✅ Password changed successfully");

    res.json({
      success: true,
      message: "Şifre başarıyla değiştirildi",
    });
  } catch (error) {
    console.error("❌ Password change error:", error);
    res.status(500).json({
      success: false,
      message: "Şifre değiştirilirken hata oluştu",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
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

// @route   GET /api/v1/auth/find-tenant
// @desc    Find tenant by username/email for login
// @access  Public
router.get("/find-tenant", async (req, res) => {
  try {
    const { email, username } = req.query;

    // Support both email and username parameters for backward compatibility
    const searchEmail = email || username;

    if (!searchEmail) {
      return res.status(400).json({
        success: false,
        message: "Email gerekli",
      });
    }

    console.log("🔍 Finding tenant for email:", searchEmail);

    // Find user by email
    const user = await prisma.user.findFirst({
      where: {
        email: searchEmail,
        isActive: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    if (!user.tenant.isActive) {
      return res.status(403).json({
        success: false,
        message: "Tenant aktif değil",
      });
    }

    console.log("✅ Tenant found:", user.tenant.name);

    res.json({
      success: true,
      data: {
        tenantId: user.tenant.id,
        tenantName: user.tenant.name,
        domain: user.tenant.domain,
      },
    });
  } catch (error) {
    console.error("❌ Find tenant error:", error);
    res.status(500).json({
      success: false,
      message: "Tenant arama hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
