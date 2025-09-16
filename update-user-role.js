const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function updateUserRole() {
  try {
    const email = "engindalga6@gmail.com";

    console.log(`📝 Updating user role for: ${email}`);

    // Find user first
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }

    console.log(`👤 Current user:`, {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    // Update user role from ADMIN to MANAGER
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: "MANAGER",
      },
    });

    console.log(`✅ User role updated successfully:`, {
      id: updatedUser.id,
      email: updatedUser.email,
      oldRole: user.role,
      newRole: updatedUser.role,
      tenantId: updatedUser.tenantId,
    });
  } catch (error) {
    console.error("❌ Error updating user role:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserRole();
