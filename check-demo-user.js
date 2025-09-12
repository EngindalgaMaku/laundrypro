const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDemoUser() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'admin@demo.com' },
      include: { tenant: true }
    });
    
    console.log('Demo User:', user);
    
    if (user) {
      console.log('User found!');
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Tenant:', user.tenant?.name);
      console.log('Tenant Active:', user.tenant?.isActive);
    } else {
      console.log('Demo user not found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDemoUser();

