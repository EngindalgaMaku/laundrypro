const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log("🌱 Demo verileri oluşturuluyor...");

    // Demo Tenant oluştur
    const demoTenant = await prisma.tenant.upsert({
      where: { id: "demo-tenant-1" },
      update: {},
      create: {
        id: "demo-tenant-1",
        name: "Demo Halı Yıkama",
        domain: "demo.halitr.com",
        subdomain: "demo",
        settings: {
          businessName: "Demo Halı Yıkama",
          address: "İstanbul, Türkiye",
          phone: "+90 212 555 0123",
          email: "info@demo.halitr.com",
        },
        isActive: true,
      },
    });

    console.log("✅ Demo tenant oluşturuldu:", demoTenant.name);

    // SUPER_ADMIN kullanıcısı oluştur (sistem yöneticisi - tenant bağımsız)
    const hashedPassword = await bcrypt.hash("demo123", 10);

    const superAdmin = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: "superadmin@system.com",
          tenantId: demoTenant.id, // Temporary tenant assignment
        },
      },
      update: {},
      create: {
        email: "superadmin@system.com",
        password: hashedPassword,
        firstName: "System",
        lastName: "Administrator",
        role: "SUPER_ADMIN",
        tenantId: demoTenant.id,
        isActive: true,
      },
    });

    console.log("✅ Super Admin kullanıcısı oluşturuldu:", superAdmin.email);

    const demoAdmin = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: "admin@demo.com",
          tenantId: demoTenant.id,
        },
      },
      update: {},
      create: {
        email: "admin@demo.com",
        password: hashedPassword,
        firstName: "Demo",
        lastName: "Admin",
        role: "ADMIN",
        tenantId: demoTenant.id,
        isActive: true,
      },
    });

    console.log("✅ Demo admin kullanıcısı oluşturuldu:", demoAdmin.email);

    // Demo Manager kullanıcısı oluştur
    const demoManager = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: "manager@demo.com",
          tenantId: demoTenant.id,
        },
      },
      update: {},
      create: {
        email: "manager@demo.com",
        password: hashedPassword,
        firstName: "Demo",
        lastName: "Manager",
        role: "MANAGER",
        tenantId: demoTenant.id,
        isActive: true,
      },
    });

    console.log("✅ Demo manager kullanıcısı oluşturuldu:", demoManager.email);

    // Demo Employee kullanıcısı oluştur
    const demoEmployee = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: "employee@demo.com",
          tenantId: demoTenant.id,
        },
      },
      update: {},
      create: {
        email: "employee@demo.com",
        password: hashedPassword,
        firstName: "Demo",
        lastName: "Employee",
        role: "EMPLOYEE",
        tenantId: demoTenant.id,
        isActive: true,
      },
    });

    console.log(
      "✅ Demo employee kullanıcısı oluşturuldu:",
      demoEmployee.email
    );

    // Demo hizmetler oluştur
    const services = [
      {
        name: "Halı Yıkama (m²)",
        description: "Profesyonel halı yıkama hizmeti",
        price: 25.0,
        unit: "m²",
        category: "Yıkama",
        tenantId: demoTenant.id,
      },
      {
        name: "Kilim Yıkama (adet)",
        description: "Kilim yıkama hizmeti",
        price: 15.0,
        unit: "adet",
        category: "Yıkama",
        tenantId: demoTenant.id,
      },
      {
        name: "Koltuk Yıkama (takım)",
        description: "Koltuk takımı yıkama",
        price: 80.0,
        unit: "takım",
        category: "Yıkama",
        tenantId: demoTenant.id,
      },
      {
        name: "Teslimat Ücreti",
        description: "Adrese teslimat ücreti",
        price: 20.0,
        unit: "adet",
        category: "Teslimat",
        tenantId: demoTenant.id,
      },
    ];

    for (const service of services) {
      const existingService = await prisma.service.findFirst({
        where: {
          name: service.name,
          tenantId: service.tenantId,
        },
      });

      if (!existingService) {
        await prisma.service.create({
          data: service,
        });
      }
    }

    console.log("✅ Demo hizmetler oluşturuldu");

    // Demo müşteriler oluştur
    const customers = [
      {
        name: "Ahmet Yılmaz",
        phone: "0532 123 4567",
        email: "ahmet@email.com",
        address: "Kadıköy, İstanbul",
        district: "Kadıköy",
        city: "İstanbul",
        postalCode: "34710",
        tenantId: demoTenant.id,
      },
      {
        name: "Fatma Demir",
        phone: "0533 987 6543",
        email: "fatma@email.com",
        address: "Beşiktaş, İstanbul",
        district: "Beşiktaş",
        city: "İstanbul",
        postalCode: "34353",
        tenantId: demoTenant.id,
      },
      {
        name: "Mehmet Kaya",
        phone: "0534 555 1234",
        email: "mehmet@email.com",
        address: "Şişli, İstanbul",
        district: "Şişli",
        city: "İstanbul",
        postalCode: "34380",
        tenantId: demoTenant.id,
      },
    ];

    for (const customer of customers) {
      await prisma.customer.upsert({
        where: {
          phone_tenantId: {
            phone: customer.phone,
            tenantId: customer.tenantId,
          },
        },
        update: {},
        create: customer,
      });
    }

    console.log("✅ Demo müşteriler oluşturuldu");

    // Demo araçlar oluştur
    const vehicles = [
      {
        name: "Teslimat Aracı 1",
        plate: "34 ABC 123",
        type: "VAN",
        capacity: 50,
        tenantId: demoTenant.id,
      },
      {
        name: "Teslimat Aracı 2",
        plate: "34 DEF 456",
        type: "VAN",
        capacity: 50,
        tenantId: demoTenant.id,
      },
    ];

    for (const vehicle of vehicles) {
      await prisma.vehicle.upsert({
        where: {
          plate_tenantId: {
            plate: vehicle.plate,
            tenantId: vehicle.tenantId,
          },
        },
        update: {},
        create: vehicle,
      });
    }

    console.log("✅ Demo araçlar oluşturuldu");

    console.log("\n🎉 Demo verileri başarıyla oluşturuldu!");
    console.log("\n📋 Demo Hesaplar:");
    console.log(
      "🔥 Super Admin: superadmin@system.com / demo123 (Sistem Yöneticisi)"
    );
    console.log("👑 Admin: admin@demo.com / demo123");
    console.log("👨‍💼 Manager: manager@demo.com / demo123");
    console.log("👷 Employee: employee@demo.com / demo123");
    console.log("\n🏢 Tenant ID: demo-tenant-1");
  } catch (error) {
    console.error("❌ Seed hatası:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
