const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");
const tenantMiddleware = require("../middleware/tenant");

const prisma = new PrismaClient();
const router = express.Router();

// Apply tenant middleware to all routes
router.use(tenantMiddleware);

// Financial Reports Routes

// GET /reports/financial/summary
router.get("/financial/summary", auth, async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const tenantId = req.tenantId;

    // Get date range based on period
    const now = new Date();
    let startDate;
    switch (period) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get orders for the period
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        items: {
          include: {
            service: true,
          },
        },
        customer: true,
      },
    });

    // Calculate metrics
    const totalRevenue = orders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount),
      0
    );

    const totalExpenses = totalRevenue * 0.3; // Mock 30% expense ratio
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Get unique customers
    const uniqueCustomers = [...new Set(orders.map((o) => o.customerId))];
    const customerCount = uniqueCustomers.length;

    // Get top services
    const serviceRevenue = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const serviceName = item.service.name;
        serviceRevenue[serviceName] =
          (serviceRevenue[serviceName] || 0) + parseFloat(item.totalPrice);
      });
    });

    const topServices = Object.entries(serviceRevenue)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Monthly trend (last 3 months)
    const monthlyTrend = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthOrders = await prisma.order.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      const monthRevenue = monthOrders.reduce(
        (sum, order) => sum + parseFloat(order.totalAmount),
        0
      );

      monthlyTrend.push({
        month: monthStart.toLocaleDateString("tr-TR", { month: "short" }),
        revenue: monthRevenue,
        orders: monthOrders.length,
      });
    }

    const summary = {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin: Math.round(profitMargin * 100) / 100,
      orderCount,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      customerCount,
      topServices,
      monthlyTrend,
    };

    res.json({
      success: true,
      message: "Finansal özet başarıyla alındı",
      data: summary,
    });
  } catch (error) {
    console.error("Financial summary error:", error);
    res.status(500).json({
      success: false,
      message: "Finansal özet alınırken hata oluştu",
      data: {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
        orderCount: 0,
        averageOrderValue: 0,
        customerCount: 0,
        topServices: [],
        monthlyTrend: [],
      },
    });
  }
});

// GET /reports/financial/revenue
router.get("/financial/revenue", auth, async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const tenantId = req.tenantId;

    // Get date range
    const now = new Date();
    let startDate;
    switch (period) {
      case "daily":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // Last 12 weeks
        break;
      case "yearly":
        startDate = new Date(now.getFullYear() - 2, 0, 1); // Last 3 years
        break;
      default: // monthly
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1); // Last 12 months
    }

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        items: {
          include: {
            service: true,
          },
        },
      },
    });

    const totalRevenue = orders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount),
      0
    );

    // Calculate growth (compare with previous period)
    const previousPeriodStart = new Date(
      startDate.getTime() - (now.getTime() - startDate.getTime())
    );
    const previousOrders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: previousPeriodStart,
          lt: startDate,
        },
      },
    });

    const previousRevenue = previousOrders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount),
      0
    );

    const revenueGrowth =
      previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
        : 0;

    // Revenue by service
    const serviceRevenue = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const serviceName = item.service.name;
        serviceRevenue[serviceName] =
          (serviceRevenue[serviceName] || 0) + parseFloat(item.totalPrice);
      });
    });

    const revenueByService = Object.entries(serviceRevenue)
      .map(([service, revenue]) => ({ service, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Revenue by time period
    const revenueByMonth = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthOrders = orders.filter(
        (order) => order.createdAt >= monthStart && order.createdAt <= monthEnd
      );

      const monthRevenue = monthOrders.reduce(
        (sum, order) => sum + parseFloat(order.totalAmount),
        0
      );

      revenueByMonth.push({
        month: monthStart.toLocaleDateString("tr-TR", {
          month: "short",
          year: "numeric",
        }),
        revenue: monthRevenue,
      });
    }

    const revenueData = {
      totalRevenue,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      revenueByService,
      revenueByMonth,
    };

    res.json({
      success: true,
      message: "Gelir analizi başarıyla alındı",
      data: revenueData,
    });
  } catch (error) {
    console.error("Revenue analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Gelir analizi alınırken hata oluştu",
      data: {
        totalRevenue: 0,
        revenueGrowth: 0,
        revenueByService: [],
        revenueByMonth: [],
      },
    });
  }
});

// GET /reports/financial/customers
router.get("/financial/customers", auth, async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const tenantId = req.tenantId;

    const now = new Date();
    let startDate;
    switch (period) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get total customers
    const totalCustomers = await prisma.customer.count({
      where: { tenantId },
    });

    // Get new customers in period
    const newCustomers = await prisma.customer.count({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
    });

    // Get orders for the period
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        customer: true,
      },
    });

    // Calculate customer metrics
    const customerOrderCount = {};
    const customerRevenue = {};

    orders.forEach((order) => {
      const customerId = order.customerId;
      customerOrderCount[customerId] =
        (customerOrderCount[customerId] || 0) + 1;
      customerRevenue[customerId] =
        (customerRevenue[customerId] || 0) + parseFloat(order.totalAmount);
    });

    const returningCustomers = Object.keys(customerOrderCount).filter(
      (customerId) => customerOrderCount[customerId] > 1
    ).length;

    const customerRetention =
      totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

    const totalRevenue = orders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount),
      0
    );
    const averageOrderValue =
      orders.length > 0 ? totalRevenue / orders.length : 0;

    // Get top customers
    const topCustomers = Object.entries(customerRevenue)
      .map(([customerId, totalSpent]) => {
        const customer = orders.find(
          (o) => o.customerId === customerId
        )?.customer;
        return {
          name: customer?.name || "Unknown",
          totalSpent,
          orderCount: customerOrderCount[customerId] || 0,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    const customerData = {
      totalCustomers,
      newCustomers,
      returningCustomers,
      customerRetention: Math.round(customerRetention * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      topCustomers,
    };

    res.json({
      success: true,
      message: "Müşteri analizi başarıyla alındı",
      data: customerData,
    });
  } catch (error) {
    console.error("Customer analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Müşteri analizi alınırken hata oluştu",
      data: {
        totalCustomers: 0,
        newCustomers: 0,
        returningCustomers: 0,
        customerRetention: 0,
        averageOrderValue: 0,
        topCustomers: [],
      },
    });
  }
});

// Mock routes for other endpoints that don't have corresponding tables
// GET /reports/financial/expenses (mock for now)
router.get("/financial/expenses", auth, async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const tenantId = req.tenantId;

    // Get revenue to calculate estimated expenses
    const now = new Date();
    let startDate;
    switch (period) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
        },
      },
    });

    const totalRevenue = orders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount),
      0
    );

    // Estimated expenses based on revenue
    const totalExpenses = totalRevenue * 0.3; // 30% expense ratio
    const expenseGrowth = -2.5; // Mock growth

    const expensesByCategory = [
      { category: "Deterjan", expenses: totalExpenses * 0.4 },
      { category: "Elektrik", expenses: totalExpenses * 0.25 },
      { category: "Su", expenses: totalExpenses * 0.2 },
      { category: "Personel", expenses: totalExpenses * 0.15 },
    ];

    // Monthly expenses
    const expensesByMonth = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthOrders = orders.filter(
        (order) => order.createdAt.getMonth() === monthStart.getMonth()
      );
      const monthRevenue = monthOrders.reduce(
        (sum, order) => sum + parseFloat(order.totalAmount),
        0
      );

      expensesByMonth.push({
        month: monthStart.toLocaleDateString("tr-TR", { month: "short" }),
        expenses: monthRevenue * 0.3,
      });
    }

    const expenseData = {
      totalExpenses,
      expenseGrowth,
      expensesByCategory,
      expensesByMonth,
    };

    res.json({
      success: true,
      message: "Gider analizi başarıyla alındı",
      data: expenseData,
    });
  } catch (error) {
    console.error("Expense analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Gider analizi alınırken hata oluştu",
      data: {
        totalExpenses: 0,
        expenseGrowth: 0,
        expensesByCategory: [],
        expensesByMonth: [],
      },
    });
  }
});

// GET /reports/financial/profit-loss
router.get("/financial/profit-loss", auth, async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const tenantId = req.tenantId;

    const now = new Date();
    let startDate;
    switch (period) {
      case "daily":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "yearly":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // monthly
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
        items: {
          include: {
            service: true,
          },
        },
      },
    });

    const revenue = orders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount),
      0
    );

    const expenses = revenue * 0.3; // Mock 30% expense ratio
    const grossProfit = revenue - expenses;
    const taxes = grossProfit * 0.1; // Mock 10% tax
    const netProfit = grossProfit - taxes;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    // Service revenue breakdown
    const serviceRevenue = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const serviceName = item.service.name;
        serviceRevenue[serviceName] =
          (serviceRevenue[serviceName] || 0) + parseFloat(item.totalPrice);
      });
    });

    const profitLossData = {
      revenue,
      expenses,
      grossProfit,
      netProfit,
      profitMargin: Math.round(profitMargin * 100) / 100,
      breakdown: {
        serviceRevenue: Object.entries(serviceRevenue).map(
          ([service, revenue]) => ({ service, revenue })
        ),
        operatingExpenses: [
          { category: "Deterjan", amount: expenses * 0.4 },
          { category: "Elektrik", amount: expenses * 0.25 },
          { category: "Su", amount: expenses * 0.2 },
          { category: "Personel", amount: expenses * 0.15 },
        ],
        otherIncome: revenue * 0.05, // Mock 5% other income
        taxes,
      },
    };

    res.json({
      success: true,
      message: "Kâr-Zarar raporu başarıyla alındı",
      data: profitLossData,
    });
  } catch (error) {
    console.error("Profit loss report error:", error);
    res.status(500).json({
      success: false,
      message: "Kâr-Zarar raporu alınırken hata oluştu",
      data: {
        revenue: 0,
        expenses: 0,
        grossProfit: 0,
        netProfit: 0,
        profitMargin: 0,
        breakdown: {
          serviceRevenue: [],
          operatingExpenses: [],
          otherIncome: 0,
          taxes: 0,
        },
      },
    });
  }
});

module.exports = router;
