const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function addDemoData() {
  try {
    console.log("🎲 Adding demo data...");

    // Add customers to Engin's tenant
    const customers = await prisma.customer.createMany({
      data: [
        {
          tenantId: "demo-tenant-1",
          name: "Ali Veli",
          phone: "+90 532 111 1111",
          email: "ali@example.com",
          address: "Atatürk Cad. No:123",
          district: "Kadıköy",
          city: "İstanbul",
        },
        {
          tenantId: "demo-tenant-1",
          name: "Ayşe Fatma",
          phone: "+90 533 222 2222",
          email: "ayse@example.com",
          address: "İnönü Sok. No:456",
          district: "Beşiktaş",
          city: "İstanbul",
        },
        {
          tenantId: "demo-tenant-1",
          name: "Mehmet Can",
          phone: "+90 534 333 3333",
          email: "mehmet@example.com",
          address: "Cumhuriyet Mey. No:789",
          district: "Şişli",
          city: "İstanbul",
        },
      ],
    });

    console.log("✅ Added customers");

    // Create services
    await prisma.service.createMany({
      data: [
        {
          tenantId: "demo-tenant-1",
          name: "Halı Yıkama",
          description: "Profesyonel halı yıkama hizmeti",
          price: 25.0,
          unit: "m2",
          category: "Temizlik",
        },
        {
          tenantId: "demo-tenant-1",
          name: "Koltuk Yıkama",
          description: "Koltuk ve kanepe temizlik hizmeti",
          price: 150.0,
          unit: "adet",
          category: "Temizlik",
        },
      ],
    });

    console.log("✅ Added services");

    // Get customers for orders
    const createdCustomers = await prisma.customer.findMany({
      where: { tenantId: "demo-tenant-1" },
    });

    // Create orders
    const orders = [];
    for (let i = 0; i < 5; i++) {
      const customer = createdCustomers[i % createdCustomers.length];
      const statuses = [
        "PENDING",
        "PICKED_UP",
        "WASHING",
        "READY",
        "DELIVERED",
      ];
      const status = statuses[i % statuses.length];

      orders.push({
        tenantId: "demo-tenant-1",
        customerId: customer.id,
        userId: "2f67daa8-9d82-415e-80a4-046cfbde1ab9", // Engin's user ID
        orderNumber: `ENJ-${String(i + 1).padStart(3, "0")}`,
        status,
        totalAmount: 100 + i * 50,
        paidAmount: status === "DELIVERED" ? 100 + i * 50 : 0,
        notes: `Demo sipariş ${i + 1}`,
        pickupDate: status !== "PENDING" ? new Date() : null,
        deliveryDate: status === "DELIVERED" ? new Date() : null,
      });
    }

    await prisma.order.createMany({
      data: orders,
    });

    console.log("✅ Added orders");

    // Add some notifications/activities
    await prisma.notification.createMany({
      data: [
        {
          tenantId: "demo-tenant-1",
          userId: "2f67daa8-9d82-415e-80a4-046cfbde1ab9",
          title: "Yeni Sipariş",
          message: "ENJ-001 numaralı sipariş oluşturuldu",
          type: "ORDER_CREATED",
        },
        {
          tenantId: "demo-tenant-1",
          userId: "2f67daa8-9d82-415e-80a4-046cfbde1ab9",
          title: "Sipariş Tamamlandı",
          message: "ENJ-005 numaralı sipariş teslim edildi",
          type: "ORDER_DELIVERED",
        },
      ],
    });

    console.log("🎉 Demo data added successfully!");
  } catch (error) {
    console.error("❌ Error adding demo data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

addDemoData();
