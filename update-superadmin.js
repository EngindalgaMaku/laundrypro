const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateUserToSuperAdmin() {
  try {
    console.log('🔄 mackaengin@gmail.com kullanıcısını SUPER_ADMIN yapılıyor...');
    
    // Önce kullanıcıyı bul
    const user = await prisma.user.findFirst({
      where: {
        email: 'mackaengin@gmail.com'
      },
      select: {
        id: true,
        email: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    if (!user) {
      console.log('❌ mackaengin@gmail.com email adresli kullanıcı bulunamadı');
      return;
    }

    console.log('📋 Bulunan kullanıcı:', user);

    // Şimdi güncelle
    const updatedUser = await prisma.user.update({
      where: {
        email_tenantId: {
          email: 'mackaengin@gmail.com',
          tenantId: user.tenantId
        }
      },
      data: {
        role: 'SUPER_ADMIN'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    console.log('✅ Kullanıcı başarıyla SUPER_ADMIN yapıldı:', updatedUser);
    
  } catch (error) {
    if (error.code === 'P2025') {
      console.log('❌ mackaengin@gmail.com email adresli kullanıcı bulunamadı');
    } else {
      console.error('❌ Hata:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

updateUserToSuperAdmin();
