const express = require("express");
const { prisma } = require("../config/database");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/customers
// @desc    Get all customers with pagination and search
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = "name",
      sortOrder = "asc",
      isActive,
    } = req.query;

    const where = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: { orders: true },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalCount: total,
        },
      },
    });
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({
      success: false,
      message: "Müşteriler getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/customers
// @desc    Create new customer
// @access  Private
router.post("/", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, phone, email, address, district, city, postalCode, notes } =
      req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Ad, telefon ve adres gerekli",
      });
    }

    // Check if phone already exists for this tenant
    const existingCustomer = await prisma.customer.findFirst({
      where: { phone, tenantId },
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: "Bu telefon numarası zaten kayıtlı",
      });
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name,
        phone,
        email: email || null,
        address,
        district: district || null,
        city: city || null,
        postalCode: postalCode || null,
        notes: notes || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "Müşteri başarıyla oluşturuldu",
      data: { customer },
    });
  } catch (error) {
    console.error("Create customer error:", error);
    res.status(500).json({
      success: false,
      message: "Müşteri oluşturma hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   PUT /api/v1/customers/:id
// @desc    Update customer
// @access  Private
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Müşteri bulunamadı",
      });
    }

    const updateData = {};
    const allowedFields = [
      "name",
      "phone",
      "email",
      "address",
      "district",
      "city",
      "postalCode",
      "notes",
      "balance",
    ];

    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      message: "Müşteri başarıyla güncellendi",
      data: { customer: updatedCustomer },
    });
  } catch (error) {
    console.error("Update customer error:", error);
    res.status(500).json({
      success: false,
      message: "Müşteri güncelleme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
