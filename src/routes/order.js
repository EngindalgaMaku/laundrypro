const express = require("express");
const { prisma } = require("../config/database");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Generate unique order number
const generateOrderNumber = async (tenantId) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  const day = today.getDate().toString().padStart(2, "0");

  const prefix = `${year}${month}${day}`;

  // Get the last order number for today
  const lastOrder = await prisma.order.findFirst({
    where: {
      tenantId,
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: "desc",
    },
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

// @route   GET /api/v1/orders
// @desc    Get all orders with filters and pagination
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      page = 1,
      limit = 20,
      status,
      customerId,
      vehicleId,
      search,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build where clause
    const where = { tenantId };

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
              district: true,
              city: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              name: true,
              plate: true,
            },
          },
          items: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount: total,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({
      success: false,
      message: "Siparişler getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   GET /api/v1/orders/:id
// @desc    Get single order
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const order = await prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        vehicle: true,
        items: {
          include: {
            service: true,
          },
        },
        notifications: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sipariş bulunamadı",
      });
    }

    res.json({
      success: true,
      data: { order },
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Sipariş getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/orders
// @desc    Create new order
// @access  Private
router.post("/", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { customerId, items, notes, pickupDate, deliveryDate, vehicleId } =
      req.body;

    // Validate required fields
    if (!customerId || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Müşteri ve sipariş kalemleri gerekli",
      });
    }

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Müşteri bulunamadı",
      });
    }

    // Calculate total amount
    const services = await prisma.service.findMany({
      where: {
        tenantId,
        id: { in: items.map((item) => item.serviceId) },
      },
    });

    let totalAmount = 0;
    const orderItems = items.map((item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (!service) {
        throw new Error(`Service with ID ${item.serviceId} not found`);
      }

      const itemTotal = parseFloat(service.price) * (item.quantity || 1);
      totalAmount += itemTotal;

      return {
        serviceId: item.serviceId,
        quantity: item.quantity || 1,
        unitPrice: service.price,
        totalPrice: itemTotal,
        notes: item.notes || null,
      };
    });

    // Generate order number
    const orderNumber = await generateOrderNumber(tenantId);

    // Create order with items in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          customerId,
          userId,
          orderNumber,
          totalAmount,
          notes,
          pickupDate: pickupDate ? new Date(pickupDate) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          vehicleId: vehicleId || null,
          items: {
            create: orderItems,
          },
        },
        include: {
          customer: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          items: {
            include: {
              service: true,
            },
          },
        },
      });

      // Update customer total orders
      await tx.customer.update({
        where: { id: customerId },
        data: {
          totalOrders: {
            increment: 1,
          },
        },
      });

      return newOrder;
    });

    res.status(201).json({
      success: true,
      message: "Sipariş başarıyla oluşturuldu",
      data: { order },
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Sipariş oluşturma hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   PUT /api/v1/orders/:id
// @desc    Update order
// @access  Private
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const { status, notes, pickupDate, deliveryDate, vehicleId, paidAmount } =
      req.body;

    // Verify order exists and belongs to tenant
    const existingOrder = await prisma.order.findFirst({
      where: { id, tenantId },
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Sipariş bulunamadı",
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (pickupDate) updateData.pickupDate = new Date(pickupDate);
    if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
    if (vehicleId !== undefined) updateData.vehicleId = vehicleId;
    if (paidAmount !== undefined) updateData.paidAmount = paidAmount;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        vehicle: true,
        items: {
          include: {
            service: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: "Sipariş başarıyla güncellendi",
      data: { order: updatedOrder },
    });
  } catch (error) {
    console.error("Update order error:", error);
    res.status(500).json({
      success: false,
      message: "Sipariş güncelleme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   DELETE /api/v1/orders/:id
// @desc    Delete/Cancel order
// @access  Private (Admin/Manager)
router.delete("/:id", auth, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const order = await prisma.order.findFirst({
      where: { id, tenantId },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Sipariş bulunamadı",
      });
    }

    // Update status to cancelled instead of deleting
    await prisma.order.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    res.json({
      success: true,
      message: "Sipariş iptal edildi",
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Sipariş iptal etme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
