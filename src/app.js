const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth");
const tenantRoutes = require("./routes/tenant");
const orderRoutes = require("./routes/order");
const customerRoutes = require("./routes/customer");
const userRoutes = require("./routes/user");
const dashboardRoutes = require("./routes/dashboard");
const vehicleRoutes = require("./routes/vehicle");
const notificationRoutes = require("./routes/notification");
const systemRoutes = require("./routes/system");
const reportsRoutes = require("./routes/reports");
const inventoryRoutes = require("./routes/inventory");
const deliveryRoutes = require("./routes/delivery");

// Import middleware
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const tenantMiddleware = require("./middleware/tenant");
const {
  appSlugMiddleware,
  appConfigurations,
} = require("./middleware/appSlug");

// Import database
const { connectDatabase } = require("./config/database");

const app = express();

// Trust proxy for rate limiting
app.set("trust proxy", 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: "Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.",
});

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:19006"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"],
  credentials: true,
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(limiter);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.API_VERSION || "v1",
    supportedApps: Object.keys(appConfigurations),
  });
});

// Apps info endpoint
app.get("/apps", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Desteklenen uygulamalar",
    data: {
      apps: Object.keys(appConfigurations).map((slug) => ({
        slug,
        name: appConfigurations[slug].name,
        type: appConfigurations[slug].type,
        endpoints: {
          register: `/api/v1/${slug}/auth/register`,
          login: `/api/v1/${slug}/auth/login`,
          dashboard: `/api/v1/${slug}/dashboard`,
        },
      })),
    },
  });
});

// API routes
const API_PREFIX = `/api/${process.env.API_VERSION || "v1"}`;

// Multi-app routes with app slug middleware
app.use(`${API_PREFIX}/:appSlug/auth`, appSlugMiddleware, authRoutes);
app.use(
  `${API_PREFIX}/:appSlug/tenants`,
  appSlugMiddleware,
  tenantMiddleware,
  tenantRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/orders`,
  appSlugMiddleware,
  tenantMiddleware,
  orderRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/customers`,
  appSlugMiddleware,
  tenantMiddleware,
  customerRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/users`,
  appSlugMiddleware,
  tenantMiddleware,
  userRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/dashboard`,
  appSlugMiddleware,
  tenantMiddleware,
  dashboardRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/vehicles`,
  appSlugMiddleware,
  tenantMiddleware,
  vehicleRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/notifications`,
  appSlugMiddleware,
  tenantMiddleware,
  notificationRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/system`,
  appSlugMiddleware,
  tenantMiddleware,
  systemRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/reports`,
  appSlugMiddleware,
  tenantMiddleware,
  reportsRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/inventory`,
  appSlugMiddleware,
  tenantMiddleware,
  inventoryRoutes
);
app.use(
  `${API_PREFIX}/:appSlug/delivery`,
  appSlugMiddleware,
  tenantMiddleware,
  deliveryRoutes
);

// Backward compatibility - legacy routes (without app slug)
app.use(
  `${API_PREFIX}/auth`,
  (req, res, next) => {
    req.appSlug = "laundry"; // Default to laundry for backward compatibility
    req.appConfig = appConfigurations.laundry;
    next();
  },
  authRoutes
);
app.use(`${API_PREFIX}/tenants`, tenantMiddleware, tenantRoutes);
app.use(`${API_PREFIX}/orders`, tenantMiddleware, orderRoutes);
app.use(`${API_PREFIX}/customers`, tenantMiddleware, customerRoutes);
app.use(`${API_PREFIX}/users`, tenantMiddleware, userRoutes);
app.use(`${API_PREFIX}/dashboard`, tenantMiddleware, dashboardRoutes);
app.use(`${API_PREFIX}/vehicles`, tenantMiddleware, vehicleRoutes);
app.use(`${API_PREFIX}/notifications`, tenantMiddleware, notificationRoutes);
app.use(`${API_PREFIX}/system`, tenantMiddleware, systemRoutes);
app.use(`${API_PREFIX}/reports`, tenantMiddleware, reportsRoutes);
app.use(`${API_PREFIX}/inventory`, tenantMiddleware, inventoryRoutes);
app.use(`${API_PREFIX}/delivery`, tenantMiddleware, deliveryRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Start server with database connection
app.listen(PORT, async () => {
  console.log(
    `🚀 Multi-App Backend API ${
      process.env.NODE_ENV || "development"
    } modunda port ${PORT}'da çalışıyor`
  );
  console.log(`📚 API Base: http://localhost:${PORT}${API_PREFIX}`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`📱 Apps Info: http://localhost:${PORT}/apps`);

  console.log("\n📋 Desteklenen Uygulamalar:");
  Object.keys(appConfigurations).forEach((slug) => {
    console.log(`  • ${slug}: ${appConfigurations[slug].name}`);
    console.log(`    - Register: ${API_PREFIX}/${slug}/auth/register`);
    console.log(`    - Login: ${API_PREFIX}/${slug}/auth/login`);
  });

  // Connect to database
  await connectDatabase();
});

module.exports = app;
