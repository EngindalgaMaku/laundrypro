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

// Import middleware
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const tenantMiddleware = require("./middleware/tenant");

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
  });
});

// API routes
const API_PREFIX = `/api/${process.env.API_VERSION || "v1"}`;

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/tenants`, tenantMiddleware, tenantRoutes);
app.use(`${API_PREFIX}/orders`, tenantMiddleware, orderRoutes);
app.use(`${API_PREFIX}/customers`, tenantMiddleware, customerRoutes);
app.use(`${API_PREFIX}/users`, tenantMiddleware, userRoutes);
app.use(`${API_PREFIX}/dashboard`, tenantMiddleware, dashboardRoutes);
app.use(`${API_PREFIX}/vehicles`, tenantMiddleware, vehicleRoutes);
app.use(`${API_PREFIX}/notifications`, tenantMiddleware, notificationRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Start server with database connection
app.listen(PORT, async () => {
  console.log(
    `🚀 HALİTR Backend API ${
      process.env.NODE_ENV || "development"
    } modunda port ${PORT}'da çalışıyor`
  );
  console.log(`📚 API Dokümantasyon: http://localhost:${PORT}${API_PREFIX}`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);

  // Connect to database
  await connectDatabase();
});

module.exports = app;
