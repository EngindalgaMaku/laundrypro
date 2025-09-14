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

// @route   GET /api/v1/tenants
// @desc    Get all tenants (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.get("/", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status = "ALL" } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = {
      // Exclude system tenant
      id: { not: "system-tenant" },
    };

    // Add search filter
    if (search) {
      whereClause.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Add status filter
    if (status !== "ALL") {
      whereClause.isActive = status === "ACTIVE";
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              users: true,
              customers: true,
              orders: true,
            },
          },
          users: {
            where: { role: "ADMIN" },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              lastLoginAt: true,
            },
            take: 1,
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.tenant.count({ where: whereClause }),
    ]);

    // Calculate additional stats for each tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const totalRevenue = await prisma.order.aggregate({
          where: {
            tenantId: tenant.id,
            status: "DELIVERED",
          },
          _sum: {
            totalAmount: true,
          },
        });

        const owner = tenant.users[0] || null;

        return {
          id: tenant.id,
          name: tenant.name,
          type: tenant.type,
          domain: tenant.domain,
          subdomain: tenant.subdomain,
          status: tenant.isActive ? "ACTIVE" : "INACTIVE",
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
          settings: tenant.settings,
          owner: owner
            ? {
                id: owner.id,
                name: `${owner.firstName} ${owner.lastName}`,
                email: owner.email,
                phone: owner.phone,
                lastLogin: owner.lastLoginAt,
              }
            : null,
          stats: {
            usersCount: tenant._count.users,
            customersCount: tenant._count.customers,
            ordersCount: tenant._count.orders,
            totalRevenue: totalRevenue._sum.totalAmount || 0,
          },
        };
      })
    );

    res.json({
      success: true,
      data: {
        tenants: tenantsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all tenants error:", error);
    res.status(500).json({
      success: false,
      message: "Firmalar getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/tenants
// @desc    Create new tenant (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.post("/", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const {
      name,
      type,
      domain,
      subdomain,
      owner: { firstName, lastName, email, phone, password },
    } = req.body;

    if (!name || !type || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Gerekli alanları doldurun",
      });
    }

    // Check if domain/subdomain already exists
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ domain }, { subdomain }],
      },
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: "Bu domain veya subdomain zaten kullanılıyor",
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

    // Hash password
    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create tenant and admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name,
          type,
          domain,
          subdomain,
          settings: {
            contactInfo: {
              email,
              phone,
            },
          },
        },
      });

      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          firstName,
          lastName,
          email,
          phone,
          password: hashedPassword,
          role: "ADMIN",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      return { tenant, adminUser };
    });

    res.status(201).json({
      success: true,
      message: "Firma başarıyla oluşturuldu",
      data: {
        tenant: result.tenant,
        adminUser: result.adminUser,
      },
    });
  } catch (error) {
    console.error("Create tenant error:", error);
    res.status(500).json({
      success: false,
      message: "Firma oluşturma hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   PUT /api/v1/tenants/:id/status
// @desc    Update tenant status (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.put("/:id/status", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (id === "system-tenant") {
      return res.status(400).json({
        success: false,
        message: "Sistem tenant durumu değiştirilemez",
      });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { isActive },
    });

    res.json({
      success: true,
      message: `Firma ${isActive ? "aktif" : "pasif"} yapıldı`,
      data: { tenant },
    });
  } catch (error) {
    console.error("Update tenant status error:", error);
    res.status(500).json({
      success: false,
      message: "Firma durum güncelleme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   DELETE /api/v1/tenants/:id
// @desc    Delete tenant (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.delete("/:id", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === "system-tenant") {
      return res.status(400).json({
        success: false,
        message: "Sistem tenant silinemez",
      });
    }

    await prisma.tenant.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Firma başarıyla silindi",
    });
  } catch (error) {
    console.error("Delete tenant error:", error);
    res.status(500).json({
      success: false,
      message: "Firma silme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
