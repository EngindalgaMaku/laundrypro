const express = require("express");
const { prisma } = require("../config/database");
const { auth } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/dashboard/overview
// @desc    Get dashboard overview data
// @access  Private
router.get("/overview", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Get order counts by status
    const orderCounts = await prisma.order.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    });

    // Transform to object for easier use
    const orderStats = orderCounts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {});

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayOrders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    // Get pending deliveries
    const pendingDeliveries = await prisma.order.findMany({
      where: {
        tenantId,
        status: "READY",
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
            address: true,
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: 10,
    });

    // Get revenue stats
    const revenueStats = await prisma.order.aggregate({
      where: {
        tenantId,
        status: "DELIVERED",
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
      _count: true,
    });

    // Get this month's revenue
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const nextMonth = new Date(thisMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const monthlyRevenue = await prisma.order.aggregate({
      where: {
        tenantId,
        status: "DELIVERED",
        updatedAt: {
          gte: thisMonth,
          lt: nextMonth,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    // Get customer count
    const customerCount = await prisma.customer.count({
      where: { tenantId, isActive: true },
    });

    // Get vehicle utilization
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: {
          select: {
            orders: {
              where: {
                status: {
                  in: ["PICKED_UP", "WASHING"],
                },
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        orderStats: {
          total: Object.values(orderStats).reduce(
            (sum, count) => sum + count,
            0
          ),
          pending: orderStats.PENDING || 0,
          pickedUp: orderStats.PICKED_UP || 0,
          washing: orderStats.WASHING || 0,
          ready: orderStats.READY || 0,
          delivered: orderStats.DELIVERED || 0,
          cancelled: orderStats.CANCELLED || 0,
        },
        todayOrders,
        pendingDeliveries,
        revenue: {
          total: revenueStats._sum.totalAmount || 0,
          paid: revenueStats._sum.paidAmount || 0,
          pending:
            (revenueStats._sum.totalAmount || 0) -
            (revenueStats._sum.paidAmount || 0),
          ordersCount: revenueStats._count,
          thisMonth: monthlyRevenue._sum.totalAmount || 0,
          monthlyOrdersCount: monthlyRevenue._count || 0,
        },
        customerCount,
        vehicles: vehicles.map((v) => ({
          id: v.id,
          name: v.name,
          plate: v.plate,
          activeOrders: v._count.orders,
          capacity: v.capacity,
        })),
      },
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    res.status(500).json({
      success: false,
      message: "Dashboard verisi getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   GET /api/v1/dashboard/recent-activities
// @desc    Get recent activities
// @access  Private
router.get("/recent-activities", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const limit = parseInt(req.query.limit) || 20;

    // Get recent order updates
    const recentOrders = await prisma.order.findMany({
      where: { tenantId },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
    });

    // Transform to activity format
    const activities = recentOrders.map((order) => ({
      id: order.id,
      type: "ORDER",
      title: `Sipariş ${order.orderNumber}`,
      description: `${order.customer.name} - ${order.status}`,
      status: order.status,
      user: order.user
        ? `${order.user.firstName} ${order.user.lastName}`
        : null,
      timestamp: order.updatedAt,
      metadata: {
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        amount: order.totalAmount,
      },
    }));

    res.json({
      success: true,
      data: { activities },
    });
  } catch (error) {
    console.error("Recent activities error:", error);
    res.status(500).json({
      success: false,
      message: "Son aktiviteler getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   GET /api/v1/dashboard/charts/revenue
// @desc    Get revenue chart data
// @access  Private
router.get("/charts/revenue", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const period = req.query.period || "monthly"; // daily, weekly, monthly

    let groupBy, dateFormat;
    let startDate = new Date();

    switch (period) {
      case "daily":
        startDate.setDate(startDate.getDate() - 30);
        groupBy = { day: true, month: true, year: true };
        dateFormat = "YYYY-MM-DD";
        break;
      case "weekly":
        startDate.setDate(startDate.getDate() - 7 * 12); // 12 weeks
        groupBy = { week: true, year: true };
        dateFormat = "YYYY-[W]WW";
        break;
      case "monthly":
      default:
        startDate.setMonth(startDate.getMonth() - 12);
        groupBy = { month: true, year: true };
        dateFormat = "YYYY-MM";
        break;
    }

    const revenueData = await prisma.order.findMany({
      where: {
        tenantId,
        status: "DELIVERED",
        updatedAt: {
          gte: startDate,
        },
      },
      select: {
        totalAmount: true,
        updatedAt: true,
      },
    });

    // Group data by period
    const chartData = revenueData.reduce((acc, order) => {
      const date = order.updatedAt;
      let key;

      switch (period) {
        case "daily":
          key = date.toISOString().split("T")[0];
          break;
        case "weekly":
          const week = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
          key = `${date.getFullYear()}-W${week.toString().padStart(2, "0")}`;
          break;
        case "monthly":
        default:
          key = `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;
          break;
      }

      if (!acc[key]) {
        acc[key] = { period: key, revenue: 0, orders: 0 };
      }

      acc[key].revenue += parseFloat(order.totalAmount);
      acc[key].orders += 1;

      return acc;
    }, {});

    const chartArray = Object.values(chartData).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    res.json({
      success: true,
      data: {
        period,
        chart: chartArray,
      },
    });
  } catch (error) {
    console.error("Revenue chart error:", error);
    res.status(500).json({
      success: false,
      message: "Gelir grafiği getirme hatası",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
