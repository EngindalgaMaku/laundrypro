const express = require("express");
const { prisma } = require("../config/database");
const { auth } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/notifications
// @desc    Get user notifications
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, isRead } = req.query;

    const where = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              customer: {
                select: { name: true },
              },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
        },
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Bildirimler getirme hatası",
    });
  }
});

// @route   PUT /api/v1/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put("/:id/read", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Bildirim bulunamadı",
      });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      success: true,
      message: "Bildirim okundu olarak işaretlendi",
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({
      success: false,
      message: "Bildirim güncelleme hatası",
    });
  }
});

// @route   PUT /api/v1/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put("/read-all", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({
      success: true,
      message: "Tüm bildirimler okundu olarak işaretlendi",
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({
      success: false,
      message: "Bildirimler güncelleme hatası",
    });
  }
});

// @route   GET /api/v1/notifications/settings
// @desc    Get user notification settings
// @access  Private
router.get("/settings", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user notification preferences
    let userSettings = await prisma.userNotificationSettings.findFirst({
      where: { userId },
    });

    // If no settings exist, create default ones
    if (!userSettings) {
      userSettings = await prisma.userNotificationSettings.create({
        data: {
          userId,
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true,
        },
      });
    }

    res.json({
      success: true,
      data: {
        emailNotifications: userSettings.emailNotifications,
        smsNotifications: userSettings.smsNotifications,
        pushNotifications: userSettings.pushNotifications,
      },
    });
  } catch (error) {
    console.error("Get notification settings error:", error);
    res.status(500).json({
      success: false,
      message: "Bildirim ayarları getirme hatası",
    });
  }
});

// @route   PUT /api/v1/notifications/settings
// @desc    Update user notification settings
// @access  Private
router.put("/settings", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { emailNotifications, smsNotifications, pushNotifications } =
      req.body;

    // Upsert user notification settings
    const updatedSettings = await prisma.userNotificationSettings.upsert({
      where: { userId },
      update: {
        emailNotifications: emailNotifications ?? true,
        smsNotifications: smsNotifications ?? false,
        pushNotifications: pushNotifications ?? true,
      },
      create: {
        userId,
        emailNotifications: emailNotifications ?? true,
        smsNotifications: smsNotifications ?? false,
        pushNotifications: pushNotifications ?? true,
      },
    });

    res.json({
      success: true,
      data: {
        emailNotifications: updatedSettings.emailNotifications,
        smsNotifications: updatedSettings.smsNotifications,
        pushNotifications: updatedSettings.pushNotifications,
      },
      message: "Bildirim ayarları başarıyla güncellendi",
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    res.status(500).json({
      success: false,
      message: "Bildirim ayarları güncelleme hatası",
    });
  }
});

module.exports = router;
