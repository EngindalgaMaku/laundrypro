const express = require("express");
const bcrypt = require("bcryptjs");
const { prisma } = require("../config/database");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/users
// @desc    Get all users in tenant
// @access  Private (Admin/Manager)
router.get(
  "/",
  auth,
  authorize("ADMIN", "MANAGER", "BUSINESS_OWNER"),
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { page = 1, limit = 20 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: { tenantId, isActive: true },
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
          skip,
          take: parseInt(limit),
          orderBy: { firstName: "asc" },
        }),
        prisma.user.count({ where: { tenantId, isActive: true } }),
      ]);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalCount: total,
          },
        },
      });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({
        success: false,
        message: "Kullanıcılar getirme hatası",
      });
    }
  }
);

// @route   POST /api/v1/users
// @desc    Create new user
// @access  Private (Admin)
router.post(
  "/",
  auth,
  authorize("ADMIN", "BUSINESS_OWNER"),
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId;
      const {
        firstName,
        lastName,
        email,
        phone,
        password,
        role = "EMPLOYEE",
      } = req.body;

      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Gerekli alanları doldurun",
        });
      }

      // Check if email already exists
      const existingUser = await prisma.user.findFirst({
        where: { email, tenantId },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Bu email adresi zaten kullanılıyor",
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await prisma.user.create({
        data: {
          tenantId,
          firstName,
          lastName,
          email,
          phone: phone || null,
          password: hashedPassword,
          role,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        success: true,
        message: "Kullanıcı başarıyla oluşturuldu",
        data: { user },
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({
        success: false,
        message: "Kullanıcı oluşturma hatası",
      });
    }
  }
);

// @route   GET /api/v1/users/all
// @desc    Get all users across all tenants (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.get("/all", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      role = "ALL",
      status = "ALL",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = {
      // Exclude system tenant users except for search
      tenantId: { not: "system-tenant" },
    };

    // Add search filter
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Add role filter
    if (role !== "ALL") {
      if (role === "ROLE_ADMIN") {
        whereClause.role = { in: ["ADMIN", "SUPER_ADMIN"] };
      } else if (role === "ROLE_USER") {
        whereClause.role = { in: ["EMPLOYEE", "MANAGER"] };
      } else {
        whereClause.role = role;
      }
    }

    // Add status filter
    if (status !== "ALL") {
      whereClause.isActive = status === "ACTIVE";
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    // Add additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Count login sessions (approximate)
        const loginCount = Math.floor(Math.random() * 200) + 10; // Mock for now

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.isActive ? "ACTIVE" : "INACTIVE",
          lastLogin: user.lastLoginAt,
          createdAt: user.createdAt,
          company: user.tenant ? user.tenant.name : null,
          loginCount,
          tenant: user.tenant,
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Kullanıcılar getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/users/system
// @desc    Create new system user (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.post("/system", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role = "EMPLOYEE",
      tenantId,
    } = req.body;

    if (!firstName || !lastName || !email || !password || !tenantId) {
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

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(400).json({
        success: false,
        message: "Geçersiz firma seçimi",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        tenantId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        password: hashedPassword,
        role,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Kullanıcı başarıyla oluşturuldu",
      data: { user },
    });
  } catch (error) {
    console.error("Create system user error:", error);
    res.status(500).json({
      success: false,
      message: "Kullanıcı oluşturma hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   PUT /api/v1/users/:id/status
// @desc    Update user status (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.put("/:id/status", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Prevent deactivating super admin
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true, tenantId: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Sistem yöneticisinin durumu değiştirilemez",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    res.json({
      success: true,
      message: `Kullanıcı ${isActive ? "aktif" : "pasif"} yapıldı`,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({
      success: false,
      message: "Kullanıcı durum güncelleme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   DELETE /api/v1/users/:id
// @desc    Delete user (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.delete("/:id", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting super admin
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Kullanıcı bulunamadı",
      });
    }

    if (user.role === "SUPER_ADMIN") {
      return res.status(400).json({
        success: false,
        message: "Sistem yöneticisi silinemez",
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Kullanıcı başarıyla silindi",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Kullanıcı silme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   GET /api/v1/users/:id
// @desc    Get user details (for SUPER_ADMIN only)
// @access  Private (SUPER_ADMIN only)
router.get("/:id", auth, authorize("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            orders: true,
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

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({
      success: false,
      message: "Kullanıcı detayları getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
