const axios = require('axios');

async function testAPICall() {
  try {
    const loginData = {
      email: 'mackaengin@gmail.com',
      password: '123456',
      tenantId: 'demo-tenant-1'
    };

    console.log('🔐 Testing API call to:', 'http://laundry.kodleon.com/api/v1/laundry/auth/login');
    console.log('📤 Request data:', loginData);

    const response = await axios.post('http://laundry.kodleon.com/api/v1/laundry/auth/login', loginData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ API call successful!');
    console.log('📥 Response status:', response.status);
    console.log('📥 Response data:', response.data);

  } catch (error) {
    console.error('❌ API call failed:', error.message);
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
      console.error('❌ Response data:', error.response.data);
      console.error('❌ Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('❌ No response received:', error.request);
    }
    console.error('❌ Full error:', error);
  }
}

testAPICall();
