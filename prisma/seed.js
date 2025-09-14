const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Clean existing data
  await prisma.notification.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.service.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  console.log("🗑️ Cleaned existing data");

  // Create password hash
  const hashedPassword = await bcrypt.hash("123456", 10);

  // Create Super Admin Tenant (System)
  const systemTenant = await prisma.tenant.create({
    data: {
      id: "system-tenant",
      name: "Sistem Yönetimi",
      type: "LAUNDRY_SERVICE",
      domain: "system.local",
      subdomain: "admin",
      settings: {
        systemTenant: true,
      },
    },
  });

  // Create Super Admin User
  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@demo.com",
      password: hashedPassword,
      firstName: "System",
      lastName: "Administrator",
      role: "SUPER_ADMIN",
      tenantId: systemTenant.id,
      phone: "+90 555 000 0001",
      lastLoginAt: new Date("2024-01-15T14:30:00Z"),
    },
  });

  console.log("✅ Created Super Admin");

  // Create Demo Tenants (Companies)
  const tenants = [
    {
      name: "Halı Yıkama Merkezi A.Ş.",
      type: "LAUNDRY_SERVICE",
      domain: "haliyikama.com",
      subdomain: "haliyikama",
      owner: {
        firstName: "Ahmet",
        lastName: "Yılmaz",
        email: "admin@haliyikama.com",
        phone: "+90 216 555 0101",
      },
      location: {
        city: "İstanbul",
        district: "Kadıköy",
      },
    },
    {
      name: "Temizlik Dünyası Ltd.",
      type: "LAUNDRY_SERVICE",
      domain: "temizlikdunyasi.com",
      subdomain: "temizlik",
      owner: {
        firstName: "Fatma",
        lastName: "Demir",
        email: "admin@temizlikdunyasi.com",
        phone: "+90 312 555 0202",
      },
      location: {
        city: "Ankara",
        district: "Çankaya",
      },
    },
    {
      name: "Lüks Halı Yıkama",
      type: "LAUNDRY_SERVICE",
      domain: "lukshaliyikama.com",
      subdomain: "lukshali",
      owner: {
        firstName: "Mehmet",
        lastName: "Öz",
        email: "info@lukshaliyikama.com",
        phone: "+90 232 555 0303",
      },
      location: {
        city: "İzmir",
        district: "Bornova",
      },
    },
    {
      name: "Profesyonel Temizlik Hizmeti",
      type: "LAUNDRY_SERVICE",
      domain: "proftemizlik.com",
      subdomain: "proftemizlik",
      owner: {
        firstName: "Ayşe",
        lastName: "Kaya",
        email: "info@proftemizlik.com",
        phone: "+90 224 555 0404",
      },
      location: {
        city: "Bursa",
        district: "Osmangazi",
      },
    },
    {
      name: "Express Kuru Temizleme",
      type: "LAUNDRY_SERVICE",
      domain: "expresskuru.com",
      subdomain: "express",
      owner: {
        firstName: "Ali",
        lastName: "Veli",
        email: "info@expresskuru.com",
        phone: "+90 242 555 0505",
      },
      location: {
        city: "Antalya",
        district: "Muratpaşa",
      },
    },
  ];

  const createdTenants = [];
  const createdUsers = [];

  for (const tenantData of tenants) {
    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantData.name,
        type: tenantData.type,
        domain: tenantData.domain,
        subdomain: tenantData.subdomain,
        settings: {
          location: tenantData.location,
          contactInfo: {
            email: tenantData.owner.email,
            phone: tenantData.owner.phone,
          },
        },
      },
    });

    createdTenants.push(tenant);

    // Create admin user for tenant
    const adminUser = await prisma.user.create({
      data: {
        email: tenantData.owner.email,
        password: hashedPassword,
        firstName: tenantData.owner.firstName,
        lastName: tenantData.owner.lastName,
        role: "ADMIN",
        tenantId: tenant.id,
        phone: tenantData.owner.phone,
        lastLoginAt: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ), // Random last login within week
      },
    });

    createdUsers.push(adminUser);

    // Create some employees for each tenant
    const employees = [
      {
        firstName: "Mahmut",
        lastName: "Çelik",
        email: `mahmut@${tenantData.domain}`,
        phone: `+90 ${Math.floor(Math.random() * 900 + 100)} 555 ${Math.floor(
          Math.random() * 9000 + 1000
        )}`,
      },
      {
        firstName: "Zehra",
        lastName: "Arslan",
        email: `zehra@${tenantData.domain}`,
        phone: `+90 ${Math.floor(Math.random() * 900 + 100)} 555 ${Math.floor(
          Math.random() * 9000 + 1000
        )}`,
      },
    ];

    for (const emp of employees) {
      const employee = await prisma.user.create({
        data: {
          email: emp.email,
          password: hashedPassword,
          firstName: emp.firstName,
          lastName: emp.lastName,
          role: "EMPLOYEE",
          tenantId: tenant.id,
          phone: emp.phone,
          lastLoginAt: new Date(
            Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000
          ),
        },
      });

      createdUsers.push(employee);
    }

    // Create services for each tenant
    const services = [
      { name: "Halı Yıkama", price: 25.0, unit: "m2", category: "Temizlik" },
      {
        name: "Koltuk Yıkama",
        price: 150.0,
        unit: "adet",
        category: "Temizlik",
      },
      { name: "Perde Yıkama", price: 35.0, unit: "m2", category: "Temizlik" },
      {
        name: "Battaniye Yıkama",
        price: 50.0,
        unit: "adet",
        category: "Temizlik",
      },
      {
        name: "Yatak Temizliği",
        price: 200.0,
        unit: "adet",
        category: "Temizlik",
      },
    ];

    for (const service of services) {
      await prisma.service.create({
        data: {
          ...service,
          tenantId: tenant.id,
          description: `Profesyonel ${service.name.toLowerCase()} hizmeti`,
        },
      });
    }

    // Create vehicles
    const vehicles = [
      {
        name: "Teslim Aracı 1",
        plate: `34 XX ${Math.floor(Math.random() * 900 + 100)}`,
        type: "VAN",
        capacity: 20,
      },
      {
        name: "Teslim Aracı 2",
        plate: `34 YY ${Math.floor(Math.random() * 900 + 100)}`,
        type: "TRUCK",
        capacity: 50,
      },
    ];

    for (const vehicle of vehicles) {
      await prisma.vehicle.create({
        data: {
          ...vehicle,
          tenantId: tenant.id,
        },
      });
    }

    // Create sample customers
    const customers = [
      {
        name: "Mehmet Yılmaz",
        phone: "+90 532 123 4567",
        email: "mehmet.yilmaz@email.com",
        address: "Atatürk Caddesi No: 123",
        district: tenantData.location.district,
        city: tenantData.location.city,
        postalCode: "34000",
      },
      {
        name: "Elif Kaya",
        phone: "+90 533 234 5678",
        email: "elif.kaya@email.com",
        address: "İstiklal Sokak No: 456",
        district: tenantData.location.district,
        city: tenantData.location.city,
        postalCode: "34001",
      },
      {
        name: "Can Özkan",
        phone: "+90 534 345 6789",
        email: "can.ozkan@email.com",
        address: "Cumhuriyet Bulvarı No: 789",
        district: tenantData.location.district,
        city: tenantData.location.city,
        postalCode: "34002",
      },
    ];

    const createdCustomers = [];
    for (const customer of customers) {
      const createdCustomer = await prisma.customer.create({
        data: {
          ...customer,
          tenantId: tenant.id,
        },
      });
      createdCustomers.push(createdCustomer);
    }

    // Create sample orders
    const orderStatuses = [
      "PENDING",
      "PICKED_UP",
      "WASHING",
      "READY",
      "DELIVERED",
    ];
    for (let i = 0; i < 5; i++) {
      const customer =
        createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
      const status =
        orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

      await prisma.order.create({
        data: {
          orderNumber: `${tenant.subdomain.toUpperCase()}-${String(
            i + 1
          ).padStart(3, "0")}`,
          status,
          totalAmount: Math.floor(Math.random() * 500 + 100),
          paidAmount:
            status === "DELIVERED" ? Math.floor(Math.random() * 500 + 100) : 0,
          notes: `Örnek sipariş ${i + 1}`,
          pickupDate:
            status !== "PENDING"
              ? new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000)
              : null,
          deliveryDate:
            status === "DELIVERED"
              ? new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000)
              : null,
          tenantId: tenant.id,
          customerId: customer.id,
          userId: adminUser.id,
        },
      });
    }

    console.log(`✅ Created tenant: ${tenant.name}`);
  }

  // Update customer order counts
  for (const tenant of createdTenants) {
    const customers = await prisma.customer.findMany({
      where: { tenantId: tenant.id },
      include: { orders: true },
    });

    for (const customer of customers) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: customer.orders.length,
          balance: customer.orders.reduce(
            (sum, order) =>
              sum +
              (parseFloat(order.totalAmount) - parseFloat(order.paidAmount)),
            0
          ),
        },
      });
    }
  }

  // Create some system notifications
  await prisma.notification.create({
    data: {
      title: "Sistem Güncellemesi",
      message: "Sistem başarıyla güncellendi ve yeni özellikler eklendi.",
      type: "SYSTEM",
      userId: superAdmin.id,
    },
  });

  console.log("🎉 Database seeded successfully!");
  console.log(`📊 Created:`);
  console.log(`   - ${createdTenants.length + 1} tenants (including system)`);
  console.log(`   - ${createdUsers.length + 1} users (including super admin)`);
  console.log(`   - ${createdTenants.length * 3} customers`);
  console.log(`   - ${createdTenants.length * 5} services`);
  console.log(`   - ${createdTenants.length * 2} vehicles`);
  console.log(`   - ${createdTenants.length * 5} orders`);

  console.log("\n🔑 Login Credentials:");
  console.log("Super Admin:");
  console.log("  Email: superadmin@demo.com");
  console.log("  Password: 123456");
  console.log("\nCompany Admins:");
  for (const tenantData of tenants) {
    console.log(`  ${tenantData.name}:`);
    console.log(`    Email: ${tenantData.owner.email}`);
    console.log(`    Password: 123456`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
