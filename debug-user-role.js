const axios = require('axios');

async function debugUserRole() {
  try {
    console.log('🔐 Testing login and checking user role...');
    
    const loginResponse = await axios.post('http://laundry.kodleon.com/api/v1/laundry/auth/login', {
      email: 'mackaengin@gmail.com',
      password: '123456',
      tenantId: 'demo-tenant-1'
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('✅ Login successful!');
    console.log('📋 User data from API:', JSON.stringify(loginResponse.data.data.user, null, 2));
    console.log('🎭 User role:', loginResponse.data.data.user.role);
    console.log('🏢 Tenant data:', JSON.stringify(loginResponse.data.data.tenant, null, 2));

    // Check if role is being returned correctly
    const userRole = loginResponse.data.data.user.role;
    console.log('\n🔍 Role analysis:');
    console.log('- Role value:', userRole);
    console.log('- Role type:', typeof userRole);
    console.log('- Is SUPER_ADMIN?', userRole === 'SUPER_ADMIN');
    console.log('- Is ADMIN?', userRole === 'ADMIN');
    console.log('- Is admin-level?', userRole === 'ADMIN' || userRole === 'SUPER_ADMIN');

  } catch (error) {
    console.error('❌ Login failed:', error.response?.status, error.response?.data?.message);
  }
}

debugUserRole();
