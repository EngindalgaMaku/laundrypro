const axios = require('axios');

async function testProductionServer() {
  try {
    console.log('🔍 Testing production server health...');
    
    // Test server health
    try {
      const healthResponse = await axios.get('http://laundry.kodleon.com/health', {
        timeout: 5000
      });
      console.log('✅ Server health:', healthResponse.data);
    } catch (healthError) {
      console.log('❌ Health check failed:', healthError.message);
    }

    // Test with ADMIN user (should work)
    console.log('\n🔐 Testing ADMIN login...');
    try {
      const adminResponse = await axios.post('http://laundry.kodleon.com/api/v1/laundry/auth/login', {
        email: 'admin@demo.com',
        password: 'demo123',
        tenantId: 'demo-tenant-1'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      console.log('✅ ADMIN login successful:', adminResponse.data.success);
    } catch (adminError) {
      console.log('❌ ADMIN login failed:', adminError.response?.status, adminError.response?.data?.message);
    }

    // Test with SUPER_ADMIN user (currently failing)
    console.log('\n🔐 Testing SUPER_ADMIN login...');
    try {
      const superAdminResponse = await axios.post('http://laundry.kodleon.com/api/v1/laundry/auth/login', {
        email: 'mackaengin@gmail.com',
        password: '123456',
        tenantId: 'demo-tenant-1'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      console.log('✅ SUPER_ADMIN login successful:', superAdminResponse.data.success);
    } catch (superAdminError) {
      console.log('❌ SUPER_ADMIN login failed:', superAdminError.response?.status, superAdminError.response?.data?.message);
      console.log('❌ Full error details:', superAdminError.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testProductionServer();
