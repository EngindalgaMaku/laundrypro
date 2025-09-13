const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Simulate the exact login process from auth.js
async function debugLogin() {
  try {
    const email = 'mackaengin@gmail.com';
    const password = '123456';
    const tenantId = 'demo-tenant-1';

    console.log('🔐 Debug login for:', email);
    console.log('📋 Request data:', { email, tenantId, hasPassword: !!password });

    // Find user with tenant info (exact same query as auth.js)
    const whereClause = { email, isActive: true };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    console.log('🔍 Searching user with:', whereClause);

    const user = await prisma.user.findFirst({
      where: whereClause,
      include: {
        tenant: true,
      },
    });

    console.log('👤 User found:', user ? { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      tenantId: user.tenantId 
    } : null);

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('🏢 Tenant info:', {
      id: user.tenant.id,
      name: user.tenant.name,
      isActive: user.tenant.isActive,
    });

    if (!user.tenant.isActive) {
      console.log('❌ Tenant not active');
      return;
    }

    // Check password
    console.log('🔑 Checking password...');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔑 Password match:', isMatch);

    if (!isMatch) {
      console.log('❌ Password mismatch');
      return;
    }

    // Update last login
    console.log('📝 Updating last login...');
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens - this is where the error might be
    console.log('🎫 Generating tokens...');
    
    // Check environment variables
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    
    console.log('🔐 JWT_SECRET exists:', !!jwtSecret);
    console.log('🔐 JWT_REFRESH_SECRET exists:', !!jwtRefreshSecret);
    
    if (!jwtSecret || !jwtRefreshSecret) {
      console.log('❌ Missing JWT secrets in environment');
      return;
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    console.log('📦 Token payload:', payload);

    const accessToken = jwt.sign(payload, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRE || "24h",
    });

    const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
    });

    console.log('✅ Tokens generated successfully');
    console.log('✅ Login process completed without errors');

    // Test response structure
    const response = {
      success: true,
      message: "Giriş başarılı",
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          domain: user.tenant.domain,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    };

    console.log('📤 Response structure valid:', !!response.data.user && !!response.data.tenant);

  } catch (error) {
    console.error('❌ Debug login error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugLogin();
