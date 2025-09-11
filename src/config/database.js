const { PrismaClient } = require("@prisma/client");

// Prisma client instance with error handling
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["warn", "error"],
  errorFormat: "pretty",
});

// Database connection test
const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log("📦 PostgreSQL veritabanına başarıyla bağlanıldı");

    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Veritabanı bağlantı testi başarılı");
  } catch (error) {
    console.error("❌ Veritabanı bağlantı hatası:", error);
    process.exit(1);
  }
};

// Graceful shutdown
const disconnectDatabase = async () => {
  try {
    await prisma.$disconnect();
    console.log("📦 Veritabanı bağlantısı kapatıldı");
  } catch (error) {
    console.error("❌ Veritabanı bağlantısı kapatma hatası:", error);
  }
};

// Handle process termination
process.on("SIGTERM", disconnectDatabase);
process.on("SIGINT", disconnectDatabase);
process.on("beforeExit", disconnectDatabase);

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
};
