const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    console.log('🔍 mackaengin@gmail.com kullanıcısını kontrol ediliyor...');
    
    // Tüm kullanıcıları listele
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
        tenant: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      }
    });

    console.log('📋 Tüm kullanıcılar:', allUsers);

    // Spesifik kullanıcıyı ara
    const user = await prisma.user.findFirst({
      where: {
        email: 'mackaengin@gmail.com'
      },
      include: {
        tenant: true
      }
    });

    if (user) {
      console.log('✅ Kullanıcı bulundu:', {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        tenantId: user.tenantId,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          isActive: user.tenant.isActive
        }
      });
    } else {
      console.log('❌ mackaengin@gmail.com kullanıcısı bulunamadı');
    }
    
  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
