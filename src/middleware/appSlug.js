const appConfigurations = {
  laundry: {
    name: "LaundryPro - Halı & Koltuk Yıkama",
    type: "LAUNDRY_SERVICE",
    defaultSettings: {
      currency: "TRY",
      timezone: "Europe/Istanbul",
      language: "tr",
      features: {
        carpetWashing: true,
        homePickup: true,
        deliveryTracking: true,
        customerManagement: true,
        orderManagement: true,
        vehicleManagement: true,
      },
    },
  },
  restaurant: {
    name: "Restaurant Management System",
    type: "RESTAURANT",
    defaultSettings: {
      currency: "TRY",
      timezone: "Europe/Istanbul",
      language: "tr",
      features: {
        menuManagement: true,
        tableReservation: true,
        orderManagement: true,
        inventoryManagement: true,
        staffManagement: true,
        loyaltyProgram: true,
      },
    },
  },
  hotel: {
    name: "Hotel Management System",
    type: "HOTEL",
    defaultSettings: {
      currency: "TRY",
      timezone: "Europe/Istanbul",
      language: "tr",
      features: {
        roomManagement: true,
        reservations: true,
        guestServices: true,
        housekeeping: true,
        billing: true,
        reportAnalytics: true,
      },
    },
  },
  // Yeni app'ler buraya eklenebilir
};

const appSlugMiddleware = (req, res, next) => {
  const appSlug = req.params.appSlug;

  // App slug kontrolü
  if (!appSlug || !appConfigurations[appSlug]) {
    return res.status(400).json({
      success: false,
      message: "Geçersiz uygulama tipi",
      availableApps: Object.keys(appConfigurations),
    });
  }

  // App bilgilerini request'e ekle
  req.appSlug = appSlug;
  req.appConfig = appConfigurations[appSlug];

  console.log(`🎯 App request: ${appSlug} - ${req.appConfig.name}`);

  next();
};

module.exports = {
  appSlugMiddleware,
  appConfigurations,
};
