const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLogin() {
  try {
    const email = 'mackaengin@gmail.com';
    const password = '123456'; // Test with correct password
    const tenantId = 'demo-tenant-1';
    
    console.log('🔐 Testing login for:', email);
    
    // Find user in database
    const user = await prisma.user.findFirst({
      where: {
        email: email,
        isActive: true,
        tenantId: tenantId
      },
      include: {
        tenant: true
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      tenantActive: user.tenant.isActive
    });

    // Test password comparison
    console.log('🔑 Testing password...');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔑 Password match:', isMatch);

    if (!isMatch) {
      console.log('❌ Password does not match');
      return;
    }

    // Test token generation
    const jwtSecret = process.env.JWT_SECRET || 'halitr-super-secret-jwt-key-2024';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'halitr-super-secret-refresh-key-2024';
    
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    
    const accessToken = jwt.sign(payload, jwtSecret, {
      expiresIn: '24h',
    });
    
    const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
      expiresIn: '7d',
    });
    
    console.log('✅ Tokens generated successfully');
    console.log('✅ Login test completed - user should be able to login!');
    
  } catch (error) {
    console.error('❌ Login test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();

