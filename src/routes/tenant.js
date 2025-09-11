const express = require("express");
const { prisma } = require("../config/database");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/tenants/profile
// @desc    Get tenant profile
// @access  Private
router.get("/profile", auth, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: {
        id: true,
        name: true,
        domain: true,
        subdomain: true,
        settings: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            customers: true,
            orders: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant bulunamadı",
      });
    }

    res.json({
      success: true,
      data: { tenant },
    });
  } catch (error) {
    console.error("Get tenant profile error:", error);
    res.status(500).json({
      success: false,
      message: "Tenant profili getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   PUT /api/v1/tenants/profile
// @desc    Update tenant profile
// @access  Private (Admin/Manager)
router.put(
  "/profile",
  auth,
  authorize("ADMIN", "MANAGER"),
  async (req, res) => {
    try {
      const { name, domain, settings } = req.body;

      const updateData = {};
      if (name) updateData.name = name;
      if (domain) updateData.domain = domain;
      if (settings) updateData.settings = settings;

      const tenant = await prisma.tenant.update({
        where: { id: req.user.tenantId },
        data: updateData,
      });

      res.json({
        success: true,
        message: "Tenant profili güncellendi",
        data: { tenant },
      });
    } catch (error) {
      console.error("Update tenant profile error:", error);
      res.status(500).json({
        success: false,
        message: "Tenant profili güncelleme hatası",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// @route   GET /api/v1/tenants/stats
// @desc    Get tenant statistics
// @access  Private
router.get("/stats", auth, async (req, res) => {
  try {
    const stats = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            orders: true,
            vehicles: true,
          },
        },
      },
    });

    // Additional stats
    const orderStats = await prisma.order.groupBy({
      by: ["status"],
      where: { tenantId: req.user.tenantId },
      _count: true,
    });

    const totalRevenue = await prisma.order.aggregate({
      where: {
        tenantId: req.user.tenantId,
        status: "DELIVERED",
      },
      _sum: {
        totalAmount: true,
      },
    });

    res.json({
      success: true,
      data: {
        counts: stats._count,
        ordersByStatus: orderStats,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
      },
    });
  } catch (error) {
    console.error("Get tenant stats error:", error);
    res.status(500).json({
      success: false,
      message: "İstatistik getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
