const express = require("express");
const bcrypt = require("bcryptjs");
const { prisma } = require("../config/database");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/users
// @desc    Get all users in tenant
// @access  Private (Admin/Manager)
router.get("/", auth, authorize("ADMIN", "MANAGER"), async (req, res) => {
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
});

// @route   POST /api/v1/users
// @desc    Create new user
// @access  Private (Admin)
router.post("/", auth, authorize("ADMIN"), async (req, res) => {
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
});

module.exports = router;
