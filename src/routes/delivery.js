const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");
const tenantMiddleware = require("../middleware/tenant");

const prisma = new PrismaClient();
const router = express.Router();

// Apply tenant middleware to all routes
router.use(tenantMiddleware);

// Delivery Management Routes using Order and Vehicle tables

// GET /delivery/dashboard
router.get("/dashboard", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all orders for metrics
    const allOrders = await prisma.order.findMany({
      where: { tenantId },
      include: {
        vehicle: true,
        customer: true,
      },
    });

    // Get today's orders
    const todayOrders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        vehicle: true,
        customer: true,
      },
    });

    // Get vehicles (drivers)
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    const totalDeliveries = allOrders.length;
    const pendingDeliveries = allOrders.filter(
      (o) => o.status === "PENDING"
    ).length;
    const inTransitDeliveries = allOrders.filter(
      (o) => o.status === "PICKED_UP"
    ).length;
    const completedToday = todayOrders.filter(
      (o) => o.status === "DELIVERED"
    ).length;
    const activeDrivers = vehicles.length;

    // Calculate total distance (mock calculation based on orders)
    const totalDistance = allOrders.length * 5.2; // Average 5.2km per order

    // Calculate average delivery time (mock)
    const avgDeliveryTime = 32; // minutes

    // Customer satisfaction (mock based on delivered orders)
    const deliveredOrders = allOrders.filter((o) => o.status === "DELIVERED");
    const customerSatisfaction = deliveredOrders.length > 0 ? 4.6 : 0;

    // Recent deliveries
    const recentDeliveries = allOrders
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        address: order.customer.address,
        status: order.status,
        deliveredAt:
          order.status === "DELIVERED" ? order.updatedAt.toISOString() : null,
        estimatedDelivery: order.deliveryDate?.toISOString(),
        driverName: order.vehicle?.name || "Atanmadı",
      }));

    // Delivery stats (last 7 days)
    const deliveryStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = allOrders.filter(
        (order) => order.createdAt >= date && order.createdAt < nextDate
      );

      const delivered = dayOrders.filter(
        (o) => o.status === "DELIVERED"
      ).length;
      const failed = dayOrders.filter((o) => o.status === "CANCELLED").length;

      deliveryStats.push({
        day: date.toLocaleDateString("tr-TR", { weekday: "long" }),
        delivered,
        failed,
      });
    }

    const dashboardData = {
      totalDeliveries,
      pendingDeliveries,
      inTransitDeliveries,
      completedToday,
      activeDrivers,
      totalDistance,
      avgDeliveryTime,
      customerSatisfaction,
      recentDeliveries,
      deliveryStats,
    };

    res.json({
      success: true,
      message: "Teslimat özeti başarıyla alındı",
      data: dashboardData,
    });
  } catch (error) {
    console.error("Delivery dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Teslimat özeti alınırken hata oluştu",
      data: {
        totalDeliveries: 0,
        pendingDeliveries: 0,
        inTransitDeliveries: 0,
        completedToday: 0,
        activeDrivers: 0,
        totalDistance: 0,
        avgDeliveryTime: 0,
        customerSatisfaction: 0,
        recentDeliveries: [],
        deliveryStats: [],
      },
    });
  }
});

// GET /delivery/deliveries
router.get("/deliveries", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      status,
      priority,
      driverId,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Build where clause
    let where = { tenantId };

    if (status) {
      where.status = status;
    }

    if (driverId) {
      where.vehicleId = driverId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      include: {
        customer: true,
        vehicle: true,
        items: {
          include: {
            service: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.order.count({ where });

    // Map orders to delivery format
    const deliveries = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      pickupAddress: "Mağaza - Kadıköy", // Mock pickup address
      deliveryAddress: order.customer.address,
      status: order.status,
      priority: "NORMAL", // Mock priority, could add to schema
      driverId: order.vehicleId,
      driverName: order.vehicle?.name,
      scheduledDate:
        order.pickupDate?.toISOString() || order.createdAt.toISOString(),
      deliveredAt:
        order.status === "DELIVERED" ? order.updatedAt.toISOString() : null,
      estimatedDuration: 30, // Mock duration
      actualDuration: order.status === "DELIVERED" ? 28 : null, // Mock
      distance: 5.2, // Mock distance
      notes: order.notes,
      items: order.items.map((item) => item.service.name),
      totalAmount: parseFloat(order.totalAmount),
      rating: order.status === "DELIVERED" ? 5 : null, // Mock rating
    }));

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    };

    res.json({
      success: true,
      message: "Teslimatlar başarıyla alındı",
      data: {
        deliveries,
        pagination,
      },
    });
  } catch (error) {
    console.error("Get deliveries error:", error);
    res.status(500).json({
      success: false,
      message: "Teslimatlar alınırken hata oluştu",
      data: {
        deliveries: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      },
    });
  }
});

// GET /delivery/drivers
router.get("/drivers", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { status, available } = req.query;

    let where = { tenantId };

    if (status === "ACTIVE") {
      where.isActive = true;
    } else if (status === "OFFLINE") {
      where.isActive = false;
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        orders: {
          where: {
            status: {
              in: ["PENDING", "PICKED_UP"],
            },
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    const drivers = vehicles.map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      phone: "+90 532 111 2233", // Mock phone
      email: `${vehicle.name.toLowerCase().replace(" ", "")}@example.com`,
      licenseNumber: vehicle.plate,
      vehicleType: vehicle.type,
      vehiclePlate: vehicle.plate,
      status: vehicle.isActive ? "ACTIVE" : "OFFLINE",
      available: vehicle.orders.length === 0,
      currentLocation: {
        lat: 40.9884 + Math.random() * 0.1,
        lng: 29.0275 + Math.random() * 0.1,
        address: "İstanbul",
      },
      totalDeliveries: vehicle._count.orders,
      rating: 4.0 + Math.random() * 0.8, // Mock rating between 4.0-4.8
      activeDeliveries: vehicle.orders.length,
    }));

    // Filter by availability if requested
    const filteredDrivers =
      available !== undefined
        ? drivers.filter((d) => d.available === (available === "true"))
        : drivers;

    res.json({
      success: true,
      message: "Kurye bilgileri başarıyla alındı",
      data: filteredDrivers,
    });
  } catch (error) {
    console.error("Get drivers error:", error);
    res.status(500).json({
      success: false,
      message: "Kurye bilgileri alınırken hata oluştu",
      data: [],
    });
  }
});

// GET /delivery/deliveries/:id
router.get("/deliveries/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const order = await prisma.order.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        customer: true,
        vehicle: true,
        items: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Teslimat bulunamadı",
        data: null,
      });
    }

    const delivery = {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      pickupAddress: "Mağaza - Kadıköy",
      deliveryAddress: order.customer.address,
      status: order.status,
      priority: "NORMAL",
      driverId: order.vehicleId,
      driverName: order.vehicle?.name,
      driverPhone: "+90 532 111 2233", // Mock
      scheduledDate:
        order.pickupDate?.toISOString() || order.createdAt.toISOString(),
      deliveredAt:
        order.status === "DELIVERED" ? order.updatedAt.toISOString() : null,
      estimatedDuration: 30,
      actualDuration: order.status === "DELIVERED" ? 28 : null,
      distance: 5.2,
      notes: order.notes,
      items: order.items.map((item) => item.service.name),
      totalAmount: parseFloat(order.totalAmount),
      rating: order.status === "DELIVERED" ? 5 : null,
      customerFeedback:
        order.status === "DELIVERED" ? "Çok memnun kaldım" : null,
      trackingHistory: [
        {
          timestamp: order.createdAt.toISOString(),
          status: "PENDING",
          description: "Sipariş alındı",
          location: "Mağaza",
        },
        order.pickupDate && {
          timestamp: order.pickupDate.toISOString(),
          status: "PICKED_UP",
          description: "Ürünler alındı",
          location: "Mağaza",
        },
        order.status === "DELIVERED" && {
          timestamp: order.updatedAt.toISOString(),
          status: "DELIVERED",
          description: "Teslimat tamamlandı",
          location: "Müşteri adresi",
        },
      ].filter(Boolean),
    };

    res.json({
      success: true,
      message: "Teslimat bilgisi başarıyla alındı",
      data: delivery,
    });
  } catch (error) {
    console.error("Get delivery error:", error);
    res.status(500).json({
      success: false,
      message: "Teslimat bilgisi alınırken hata oluştu",
      data: null,
    });
  }
});

// POST /delivery/deliveries
router.post("/deliveries", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { customerId, vehicleId, items, pickupDate, deliveryDate, notes } =
      req.body;

    // Generate order number
    const orderCount = await prisma.order.count({ where: { tenantId } });
    const orderNumber = `ORD-${(orderCount + 1).toString().padStart(3, "0")}`;

    // Calculate total amount (mock calculation)
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const newOrder = await prisma.order.create({
      data: {
        tenantId,
        customerId,
        orderNumber,
        status: "PENDING",
        totalAmount,
        vehicleId,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        notes,
        items: {
          create: items.map((item) => ({
            serviceId: item.serviceId,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
          })),
        },
      },
      include: {
        customer: true,
        vehicle: true,
        items: {
          include: {
            service: true,
          },
        },
      },
    });

    const newDelivery = {
      id: newOrder.id,
      orderNumber: newOrder.orderNumber,
      status: newOrder.status,
      customerName: newOrder.customer.name,
      driverName: newOrder.vehicle?.name,
      totalAmount: parseFloat(newOrder.totalAmount),
      createdAt: newOrder.createdAt.toISOString(),
    };

    res.status(201).json({
      success: true,
      message: "Teslimat başarıyla oluşturuldu",
      data: newDelivery,
    });
  } catch (error) {
    console.error("Create delivery error:", error);
    res.status(500).json({
      success: false,
      message: "Teslimat oluşturulurken hata oluştu",
    });
  }
});

// PATCH /delivery/deliveries/:id/status
router.patch("/deliveries/:id/status", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const tenantId = req.tenantId;

    const updatedOrder = await prisma.order.update({
      where: {
        id,
        tenantId,
      },
      data: {
        status,
        notes: notes || undefined,
        updatedAt: new Date(),
      },
      include: {
        customer: true,
        vehicle: true,
      },
    });

    const updatedDelivery = {
      id: updatedOrder.id,
      status: updatedOrder.status,
      notes: updatedOrder.notes,
      updatedAt: updatedOrder.updatedAt.toISOString(),
    };

    res.json({
      success: true,
      message: "Teslimat durumu güncellendi",
      data: updatedDelivery,
    });
  } catch (error) {
    console.error("Update delivery status error:", error);
    res.status(500).json({
      success: false,
      message: "Teslimat durumu güncellenirken hata oluştu",
    });
  }
});

// PATCH /delivery/deliveries/:id/assign
router.patch("/deliveries/:id/assign", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;
    const tenantId = req.tenantId;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: driverId, tenantId },
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Kurye bulunamadı",
      });
    }

    const updatedOrder = await prisma.order.update({
      where: {
        id,
        tenantId,
      },
      data: {
        vehicleId: driverId,
        status: "PICKED_UP", // Auto-update status when assigning
      },
    });

    const updatedDelivery = {
      id: updatedOrder.id,
      driverId,
      driverName: vehicle.name,
      status: updatedOrder.status,
      assignedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: "Kurye başarıyla atandı",
      data: updatedDelivery,
    });
  } catch (error) {
    console.error("Assign driver error:", error);
    res.status(500).json({
      success: false,
      message: "Kurye atanırken hata oluştu",
    });
  }
});

// GET /delivery/analytics
router.get("/analytics", auth, async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const tenantId = req.tenantId;

    const now = new Date();
    let startDate;
    switch (period) {
      case "daily":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        vehicle: true,
      },
    });

    const totalDeliveries = orders.length;
    const completedDeliveries = orders.filter(
      (o) => o.status === "DELIVERED"
    ).length;
    const completionRate =
      totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
    const avgDeliveryTime = 32; // Mock
    const customerRating = 4.6; // Mock

    // Delivery trends
    const deliveryTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayOrders = orders.filter(
        (order) => order.createdAt.toDateString() === date.toDateString()
      );

      deliveryTrends.push({
        date: date.toISOString().split("T")[0],
        deliveries: dayOrders.length,
        completed: dayOrders.filter((o) => o.status === "DELIVERED").length,
      });
    }

    // Performance metrics
    const performanceMetrics = [
      { metric: "On-time delivery", value: 89.2 },
      { metric: "First attempt success", value: 78.5 },
      { metric: "Customer satisfaction", value: 4.6 },
    ];

    // Driver performance
    const vehiclePerformance = {};
    orders.forEach((order) => {
      if (order.vehicleId) {
        if (!vehiclePerformance[order.vehicleId]) {
          vehiclePerformance[order.vehicleId] = {
            name: order.vehicle?.name || "Unknown",
            deliveries: 0,
            completed: 0,
          };
        }
        vehiclePerformance[order.vehicleId].deliveries++;
        if (order.status === "DELIVERED") {
          vehiclePerformance[order.vehicleId].completed++;
        }
      }
    });

    const driverPerformance = Object.entries(vehiclePerformance).map(
      ([vehicleId, data]) => ({
        driverId: vehicleId,
        name: data.name,
        deliveries: data.deliveries,
        rating: 4.0 + Math.random() * 0.8,
        onTime:
          data.deliveries > 0 ? (data.completed / data.deliveries) * 100 : 0,
      })
    );

    const analyticsData = {
      totalDeliveries,
      completionRate: Math.round(completionRate * 100) / 100,
      avgDeliveryTime,
      customerRating,
      deliveryTrends,
      performanceMetrics,
      driverPerformance,
    };

    res.json({
      success: true,
      message: "Teslimat analitiği başarıyla alındı",
      data: analyticsData,
    });
  } catch (error) {
    console.error("Delivery analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Teslimat analitiği alınırken hata oluştu",
      data: {
        totalDeliveries: 0,
        completionRate: 0,
        avgDeliveryTime: 0,
        customerRating: 0,
        deliveryTrends: [],
        performanceMetrics: [],
        driverPerformance: [],
      },
    });
  }
});

module.exports = router;
