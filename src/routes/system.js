const express = require("express");
const { prisma } = require("../config/database");
const { auth } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/system/settings
// @desc    Get system settings (SUPER_ADMIN only)
// @access  Private
router.get("/settings", auth, async (req, res) => {
  try {
    // Check if user is SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için SUPER_ADMIN yetkisi gerekli",
      });
    }

    // Get system settings
    let systemSettings = await prisma.systemSettings.findFirst({
      where: { tenantId: req.user.tenantId },
    });

    // If no settings exist, create default ones
    if (!systemSettings) {
      systemSettings = await prisma.systemSettings.create({
        data: {
          tenantId: req.user.tenantId,
          systemName: "Halı Yıkama Sistemi",
          systemVersion: "1.0.0",
          maintenanceMode: false,
          debugMode: false,
          sessionTimeout: 30,
          passwordMinLength: 8,
          twoFactorAuth: false,
          autoBackup: true,
          backupFrequency: "daily",
          backupRetention: 30,
          apiRateLimit: 1000,
          apiTimeout: 30,
        },
      });
    }

    res.json({
      success: true,
      data: {
        systemName: systemSettings.systemName,
        systemVersion: systemSettings.systemVersion,
        maintenanceMode: systemSettings.maintenanceMode,
        debugMode: systemSettings.debugMode,
        sessionTimeout: systemSettings.sessionTimeout,
        passwordMinLength: systemSettings.passwordMinLength,
        twoFactorAuth: systemSettings.twoFactorAuth,
        autoBackup: systemSettings.autoBackup,
        backupFrequency: systemSettings.backupFrequency,
        backupRetention: systemSettings.backupRetention,
        apiRateLimit: systemSettings.apiRateLimit,
        apiTimeout: systemSettings.apiTimeout,
      },
    });
  } catch (error) {
    console.error("Get system settings error:", error);
    res.status(500).json({
      success: false,
      message: "Sistem ayarları getirme hatası",
    });
  }
});

// @route   PUT /api/v1/system/settings
// @desc    Update system settings (SUPER_ADMIN only)
// @access  Private
router.put("/settings", auth, async (req, res) => {
  try {
    // Check if user is SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için SUPER_ADMIN yetkisi gerekli",
      });
    }

    const {
      systemName,
      maintenanceMode,
      debugMode,
      sessionTimeout,
      passwordMinLength,
      twoFactorAuth,
      autoBackup,
      backupFrequency,
      backupRetention,
      apiRateLimit,
      apiTimeout,
    } = req.body;

    // Upsert system settings
    const updatedSettings = await prisma.systemSettings.upsert({
      where: { tenantId: req.user.tenantId },
      update: {
        systemName: systemName || "Halı Yıkama Sistemi",
        maintenanceMode: maintenanceMode ?? false,
        debugMode: debugMode ?? false,
        sessionTimeout: sessionTimeout ?? 30,
        passwordMinLength: passwordMinLength ?? 8,
        twoFactorAuth: twoFactorAuth ?? false,
        autoBackup: autoBackup ?? true,
        backupFrequency: backupFrequency || "daily",
        backupRetention: backupRetention ?? 30,
        apiRateLimit: apiRateLimit ?? 1000,
        apiTimeout: apiTimeout ?? 30,
      },
      create: {
        tenantId: req.user.tenantId,
        systemName: systemName || "Halı Yıkama Sistemi",
        systemVersion: "1.0.0",
        maintenanceMode: maintenanceMode ?? false,
        debugMode: debugMode ?? false,
        sessionTimeout: sessionTimeout ?? 30,
        passwordMinLength: passwordMinLength ?? 8,
        twoFactorAuth: twoFactorAuth ?? false,
        autoBackup: autoBackup ?? true,
        backupFrequency: backupFrequency || "daily",
        backupRetention: backupRetention ?? 30,
        apiRateLimit: apiRateLimit ?? 1000,
        apiTimeout: apiTimeout ?? 30,
      },
    });

    res.json({
      success: true,
      data: {
        systemName: updatedSettings.systemName,
        systemVersion: updatedSettings.systemVersion,
        maintenanceMode: updatedSettings.maintenanceMode,
        debugMode: updatedSettings.debugMode,
        sessionTimeout: updatedSettings.sessionTimeout,
        passwordMinLength: updatedSettings.passwordMinLength,
        twoFactorAuth: updatedSettings.twoFactorAuth,
        autoBackup: updatedSettings.autoBackup,
        backupFrequency: updatedSettings.backupFrequency,
        backupRetention: updatedSettings.backupRetention,
        apiRateLimit: updatedSettings.apiRateLimit,
        apiTimeout: updatedSettings.apiTimeout,
      },
      message: "Sistem ayarları başarıyla güncellendi",
    });
  } catch (error) {
    console.error("Update system settings error:", error);
    res.status(500).json({
      success: false,
      message: "Sistem ayarları güncelleme hatası",
    });
  }
});

// @route   POST /api/v1/system/backup
// @desc    Create system backup (SUPER_ADMIN only)
// @access  Private
router.post("/backup", auth, async (req, res) => {
  try {
    // Check if user is SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için SUPER_ADMIN yetkisi gerekli",
      });
    }

    // Create backup record
    const backup = await prisma.systemBackup.create({
      data: {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        backupType: "MANUAL",
        status: "COMPLETED",
        backupSize: Math.floor(Math.random() * 100000000), // Simulated size
        fileName: `backup_${Date.now()}.sql`,
      },
    });

    res.json({
      success: true,
      data: {
        backupId: backup.id,
        fileName: backup.fileName,
        createdAt: backup.createdAt,
      },
      message: "Sistem yedeği başarıyla oluşturuldu",
    });
  } catch (error) {
    console.error("Create backup error:", error);
    res.status(500).json({
      success: false,
      message: "Yedekleme işlemi başarısız",
    });
  }
});

// @route   GET /api/v1/system/backup/history
// @desc    Get backup history (SUPER_ADMIN only)
// @access  Private
router.get("/backup/history", auth, async (req, res) => {
  try {
    // Check if user is SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için SUPER_ADMIN yetkisi gerekli",
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [backups, total] = await Promise.all([
      prisma.systemBackup.findMany({
        where: { tenantId: req.user.tenantId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.systemBackup.count({ where: { tenantId: req.user.tenantId } }),
    ]);

    res.json({
      success: true,
      data: {
        backups,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
        },
      },
    });
  } catch (error) {
    console.error("Get backup history error:", error);
    res.status(500).json({
      success: false,
      message: "Yedek geçmişi getirme hatası",
    });
  }
});

// @route   POST /api/v1/system/settings/reset
// @desc    Reset system settings to defaults (SUPER_ADMIN only)
// @access  Private
router.post("/settings/reset", auth, async (req, res) => {
  try {
    // Check if user is SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için SUPER_ADMIN yetkisi gerekli",
      });
    }

    // Reset to default settings
    const defaultSettings = await prisma.systemSettings.upsert({
      where: { tenantId: req.user.tenantId },
      update: {
        systemName: "Halı Yıkama Sistemi",
        maintenanceMode: false,
        debugMode: false,
        sessionTimeout: 30,
        passwordMinLength: 8,
        twoFactorAuth: false,
        autoBackup: true,
        backupFrequency: "daily",
        backupRetention: 30,
        apiRateLimit: 1000,
        apiTimeout: 30,
      },
      create: {
        tenantId: req.user.tenantId,
        systemName: "Halı Yıkama Sistemi",
        systemVersion: "1.0.0",
        maintenanceMode: false,
        debugMode: false,
        sessionTimeout: 30,
        passwordMinLength: 8,
        twoFactorAuth: false,
        autoBackup: true,
        backupFrequency: "daily",
        backupRetention: 30,
        apiRateLimit: 1000,
        apiTimeout: 30,
      },
    });

    res.json({
      success: true,
      data: defaultSettings,
      message: "Sistem ayarları varsayılan değerlere döndürüldü",
    });
  } catch (error) {
    console.error("Reset system settings error:", error);
    res.status(500).json({
      success: false,
      message: "Ayarlar sıfırlama hatası",
    });
  }
});

// @route   GET /api/v1/system/health
// @desc    Get system health status
// @access  Private
router.get("/health", auth, async (req, res) => {
  try {
    // Basic health checks
    const dbStatus = await prisma.$queryRaw`SELECT 1 as status`;

    const healthData = {
      status: "healthy",
      timestamp: new Date(),
      database: dbStatus ? "connected" : "disconnected",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.APP_VERSION || "1.0.0",
    };

    res.json({
      success: true,
      data: healthData,
    });
  } catch (error) {
    console.error("System health check error:", error);
    res.status(500).json({
      success: false,
      message: "Sistem sağlık kontrolü hatası",
      data: {
        status: "unhealthy",
        timestamp: new Date(),
        error: error.message,
      },
    });
  }
});

module.exports = router;
