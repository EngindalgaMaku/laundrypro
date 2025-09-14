const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function createEnginUser() {
  try {
    console.log("🔧 Creating Engin's user account...");

    // Hash password
    const hashedPassword = await bcrypt.hash("123456", 10);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: "mackaengin@gmail.com" },
    });

    if (existingUser) {
      console.log("✅ User mackaengin@gmail.com already exists!");
      console.log(`   Tenant: ${existingUser.tenantId}`);
      console.log(`   Role: ${existingUser.role}`);
      return;
    }

    // Create demo tenant
    let demoTenant;
    try {
      demoTenant = await prisma.tenant.create({
        data: {
          id: "demo-tenant-1",
          name: "Engin'in Halı Yıkama",
          type: "LAUNDRY_SERVICE",
          domain: "engin.demo.local",
          subdomain: "engin",
          settings: {
            location: {
              city: "İstanbul",
              district: "Kadıköy",
            },
            owner: "Engin Dalga",
            phone: "+90 555 123 4567",
          },
        },
      });
      console.log("✅ Created demo tenant:", demoTenant.name);
    } catch (error) {
      // Tenant might already exist
      demoTenant = await prisma.tenant.findUnique({
        where: { id: "demo-tenant-1" },
      });
      if (!demoTenant) {
        throw error;
      }
      console.log("✅ Using existing tenant:", demoTenant.name);
    }

    // Create user
    const enginUser = await prisma.user.create({
      data: {
        email: "mackaengin@gmail.com",
        password: hashedPassword,
        firstName: "Engin",
        lastName: "Dalga",
        role: "SUPER_ADMIN",
        tenantId: demoTenant.id,
        phone: "+90 555 123 4567",
        lastLoginAt: new Date(),
      },
    });

    console.log("🎉 Successfully created Engin's account!");
    console.log("📧 Email: mackaengin@gmail.com");
    console.log("🔑 Password: 123456");
    console.log("🎭 Role: SUPER_ADMIN");
    console.log("🏢 Tenant: demo-tenant-1");
  } catch (error) {
    console.error("❌ Error creating user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createEnginUser();
