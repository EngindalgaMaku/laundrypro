const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");
const tenantMiddleware = require("../middleware/tenant");

const prisma = new PrismaClient();
const router = express.Router();

// Apply tenant middleware to all routes
router.use(tenantMiddleware);

// Inventory Management Routes using Vehicle table as inventory items

// GET /inventory/summary
router.get("/summary", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Get vehicles (inventory items)
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId },
      include: {
        orders: true,
      },
    });

    // Get services as inventory categories
    const services = await prisma.service.findMany({
      where: { tenantId },
    });

    const totalItems = vehicles.length;
    const activeItems = vehicles.filter((v) => v.isActive).length;
    const inactiveItems = totalItems - activeItems;

    // Calculate total value based on orders using vehicles
    let totalValue = 0;
    vehicles.forEach((vehicle) => {
      vehicle.orders.forEach((order) => {
        totalValue += parseFloat(order.totalAmount);
      });
    });

    // Categories from services
    const categories = services.map((service) => ({
      name: service.category || "Genel",
      itemCount:
        vehicles.filter((v) => v.type === service.category).length || 1,
      value: parseFloat(service.price) * 10, // Mock calculation
    }));

    // Recent activity from recent orders
    const recentOrders = await prisma.order.findMany({
      where: {
        tenantId,
        vehicleId: { not: null },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: true,
        customer: true,
      },
    });

    const recentActivity = recentOrders.map((order) => ({
      id: order.id,
      type: "VEHICLE_ASSIGNED",
      itemName: order.vehicle?.name || "Araç",
      quantity: 1,
      action: `${order.customer.name} - ${order.status}`,
      date: order.createdAt.toISOString(),
    }));

    const summary = {
      totalItems,
      lowStockItems: Math.floor(totalItems * 0.1), // Mock 10% low stock
      outOfStockItems: inactiveItems,
      totalValue,
      categories,
      recentActivity,
    };

    res.json({
      success: true,
      message: "Envanter özeti başarıyla alındı",
      data: summary,
    });
  } catch (error) {
    console.error("Inventory summary error:", error);
    res.status(500).json({
      success: false,
      message: "Envanter özeti alınırken hata oluştu",
      data: {
        totalItems: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        totalValue: 0,
        categories: [],
        recentActivity: [],
      },
    });
  }
});

// GET /inventory/items
router.get("/items", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { category, status, search, page = 1, limit = 20 } = req.query;

    // Build where clause
    let where = { tenantId };

    if (category) {
      where.type = category;
    }

    if (status === "IN_STOCK") {
      where.isActive = true;
    } else if (status === "OUT_OF_STOCK") {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { plate: { contains: search, mode: "insensitive" } },
      ];
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      include: {
        orders: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const total = await prisma.vehicle.count({ where });

    // Map vehicles to inventory items
    const items = vehicles.map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      category: vehicle.type,
      currentStock: vehicle.isActive ? vehicle.capacity || 1 : 0,
      minStock: 1,
      maxStock: vehicle.capacity || 10,
      unitPrice: 1000.0, // Mock price
      totalValue: (vehicle.isActive ? vehicle.capacity || 1 : 0) * 1000,
      status: vehicle.isActive ? "IN_STOCK" : "OUT_OF_STOCK",
      supplier: "Araç Tedarikçisi",
      lastUpdated: vehicle.updatedAt.toISOString(),
      plate: vehicle.plate, // Additional field
      orderCount: vehicle.orders.length,
    }));

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    };

    res.json({
      success: true,
      message: "Envanter öğeleri başarıyla alındı",
      data: {
        items,
        pagination,
      },
    });
  } catch (error) {
    console.error("Get inventory items error:", error);
    res.status(500).json({
      success: false,
      message: "Envanter öğeleri alınırken hata oluştu",
      data: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
      },
    });
  }
});

// GET /inventory/categories
router.get("/categories", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Get unique vehicle types as categories
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId },
      select: { type: true },
    });

    const uniqueTypes = [...new Set(vehicles.map((v) => v.type))];

    const categories = uniqueTypes.map((type, index) => ({
      id: index + 1,
      name: type,
      description: `${type} kategorisindeki araçlar`,
    }));

    res.json({
      success: true,
      message: "Kategoriler başarıyla alındı",
      data: categories,
    });
  } catch (error) {
    console.error("Get inventory categories error:", error);
    res.status(500).json({
      success: false,
      message: "Kategoriler alınırken hata oluştu",
      data: [],
    });
  }
});

// GET /inventory/alerts/low-stock
router.get("/alerts/low-stock", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Get inactive vehicles as low stock alerts
    const inactiveVehicles = await prisma.vehicle.findMany({
      where: {
        tenantId,
        isActive: false,
      },
    });

    const lowStockAlerts = inactiveVehicles.map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      currentStock: 0,
      minStock: 1,
      category: vehicle.type,
      urgency: "HIGH",
      daysUntilEmpty: 0,
      plate: vehicle.plate,
    }));

    res.json({
      success: true,
      message: "Düşük stok uyarıları başarıyla alındı",
      data: lowStockAlerts,
    });
  } catch (error) {
    console.error("Get low stock alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Düşük stok uyarıları alınırken hata oluştu",
      data: [],
    });
  }
});

// GET /inventory/items/:id
router.get("/items/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        orders: {
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            customer: true,
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Envanter öğesi bulunamadı",
        data: null,
      });
    }

    const item = {
      id: vehicle.id,
      name: vehicle.name,
      category: vehicle.type,
      description: `${vehicle.type} - ${vehicle.plate}`,
      currentStock: vehicle.isActive ? vehicle.capacity || 1 : 0,
      minStock: 1,
      maxStock: vehicle.capacity || 10,
      unitPrice: 1000.0,
      totalValue: (vehicle.isActive ? vehicle.capacity || 1 : 0) * 1000,
      status: vehicle.isActive ? "IN_STOCK" : "OUT_OF_STOCK",
      supplier: "Araç Tedarikçisi",
      supplierContact: "supplier@example.com",
      location: "Garaj",
      barcode: vehicle.plate,
      lastUpdated: vehicle.updatedAt.toISOString(),
      createdAt: vehicle.createdAt.toISOString(),
      plate: vehicle.plate,
      recentOrders: vehicle.orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer.name,
        status: order.status,
        date: order.createdAt.toISOString(),
      })),
    };

    res.json({
      success: true,
      message: "Envanter öğesi başarıyla alındı",
      data: item,
    });
  } catch (error) {
    console.error("Get inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Envanter öğesi alınırken hata oluştu",
      data: null,
    });
  }
});

// POST /inventory/items
router.post("/items", auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { name, category, plate, capacity } = req.body;

    const newVehicle = await prisma.vehicle.create({
      data: {
        tenantId,
        name,
        plate,
        type: category || "VAN",
        capacity: capacity || 1,
        isActive: true,
      },
    });

    const newItem = {
      id: newVehicle.id,
      name: newVehicle.name,
      category: newVehicle.type,
      currentStock: newVehicle.capacity,
      minStock: 1,
      maxStock: newVehicle.capacity,
      unitPrice: 1000.0,
      totalValue: newVehicle.capacity * 1000,
      status: "IN_STOCK",
      supplier: "Araç Tedarikçisi",
      lastUpdated: newVehicle.updatedAt.toISOString(),
      createdAt: newVehicle.createdAt.toISOString(),
      plate: newVehicle.plate,
    };

    res.status(201).json({
      success: true,
      message: "Envanter öğesi başarıyla eklendi",
      data: newItem,
    });
  } catch (error) {
    console.error("Create inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Envanter öğesi eklenirken hata oluştu",
    });
  }
});

// PUT /inventory/items/:id
router.put("/items/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const { name, category, plate, capacity, isActive } = req.body;

    const updatedVehicle = await prisma.vehicle.update({
      where: {
        id,
        tenantId,
      },
      data: {
        name,
        type: category,
        plate,
        capacity,
        isActive,
      },
    });

    const updatedItem = {
      id: updatedVehicle.id,
      name: updatedVehicle.name,
      category: updatedVehicle.type,
      currentStock: updatedVehicle.isActive ? updatedVehicle.capacity : 0,
      totalValue:
        (updatedVehicle.isActive ? updatedVehicle.capacity : 0) * 1000,
      status: updatedVehicle.isActive ? "IN_STOCK" : "OUT_OF_STOCK",
      lastUpdated: updatedVehicle.updatedAt.toISOString(),
      plate: updatedVehicle.plate,
    };

    res.json({
      success: true,
      message: "Envanter öğesi başarıyla güncellendi",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Update inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Envanter öğesi güncellenirken hata oluştu",
    });
  }
});

// DELETE /inventory/items/:id
router.delete("/items/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    await prisma.vehicle.delete({
      where: {
        id,
        tenantId,
      },
    });

    res.json({
      success: true,
      message: "Envanter öğesi başarıyla silindi",
    });
  } catch (error) {
    console.error("Delete inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Envanter öğesi silinirken hata oluştu",
    });
  }
});

// PATCH /inventory/items/:id/stock
router.patch("/items/:id/stock", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type, reason } = req.body; // type: 'ADD' | 'SUBTRACT'
    const tenantId = req.tenantId;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id, tenantId },
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Envanter öğesi bulunamadı",
      });
    }

    // Update capacity based on stock operation
    const newCapacity =
      type === "ADD"
        ? (vehicle.capacity || 0) + parseInt(quantity)
        : Math.max(0, (vehicle.capacity || 0) - parseInt(quantity));

    const updatedVehicle = await prisma.vehicle.update({
      where: { id, tenantId },
      data: {
        capacity: newCapacity,
        isActive: newCapacity > 0,
      },
    });

    const updatedItem = {
      id: updatedVehicle.id,
      name: updatedVehicle.name,
      currentStock: updatedVehicle.capacity,
      lastUpdated: updatedVehicle.updatedAt.toISOString(),
    };

    res.json({
      success: true,
      message: "Stok seviyesi başarıyla güncellendi",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Update stock error:", error);
    res.status(500).json({
      success: false,
      message: "Stok güncellenirken hata oluştu",
    });
  }
});

module.exports = router;
