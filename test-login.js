const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function testLogin() {
  try {
    const email = 'admin@demo.com';
    const password = 'demo123';
    const tenantId = 'demo-tenant-1';
    
    // Simulate the login process
    console.log('Testing login process...');
    
    // Check if JWT secrets are available
    const jwtSecret = process.env.JWT_SECRET || 'halitr-super-secret-jwt-key-2024';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'halitr-super-secret-refresh-key-2024';
    
    console.log('JWT_SECRET available:', !!jwtSecret);
    console.log('JWT_REFRESH_SECRET available:', !!jwtRefreshSecret);
    
    // Test token generation
    const payload = {
      userId: '6990b262-b828-4408-b335-11dae88c606d',
      email: email,
      role: 'ADMIN',
      tenantId: tenantId,
    };
    
    const accessToken = jwt.sign(payload, jwtSecret, {
      expiresIn: '24h',
    });
    
    const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
      expiresIn: '7d',
    });
    
    console.log('Access token generated:', !!accessToken);
    console.log('Refresh token generated:', !!refreshToken);
    
    console.log('Login test completed successfully!');
    
  } catch (error) {
    console.error('Login test error:', error);
  }
}

testLogin();

