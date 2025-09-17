const { prisma } = require("../config/database");

const businessTypesData = [
  {
    name: "carpet_cleaning",
    displayName: "Halı Yıkama",
    description: "Profesyonel halı ve kilim yıkama hizmetleri",
    icon: "home-variant",
    color: "#4A90E2",
    sortOrder: 1,
  },
  {
    name: "dry_cleaning",
    displayName: "Kuru Temizleme",
    description: "Kıyafet ve kumaş kuru temizleme hizmetleri",
    icon: "tshirt-crew",
    color: "#7B68EE",
    sortOrder: 2,
  },
  {
    name: "laundry_service",
    displayName: "Çamaşır Yıkama",
    description: "Genel çamaşır yıkama ve ütü hizmetleri",
    icon: "washing-machine",
    color: "#50C878",
    sortOrder: 3,
  },
  {
    name: "upholstery_washing",
    displayName: "Döşeme Yıkama",
    description: "Koltuk, sandalye ve döşeme yıkama hizmetleri",
    icon: "sofa",
    color: "#45B7D1",
    sortOrder: 4,
  },
];

const productTemplatesData = [
  // Carpet Cleaning Products
  {
    businessTypeName: "carpet_cleaning",
    name: "Yün Halı",
    description: "El dokuma ve makine yünlü halılar",
    basePrice: 15.0,
    unit: "m2",
    category: "Halı",
    sortOrder: 1,
  },
  {
    businessTypeName: "carpet_cleaning",
    name: "Sentetik Halı",
    description: "Sentetik malzemeli halılar",
    basePrice: 8.0,
    unit: "m2",
    category: "Halı",
    sortOrder: 2,
  },
  {
    businessTypeName: "carpet_cleaning",
    name: "Antik Halı",
    description: "Değerli ve antika halılar",
    basePrice: 25.0,
    unit: "m2",
    category: "Özel Halı",
    sortOrder: 3,
  },

  // Dry Cleaning Products
  {
    businessTypeName: "dry_cleaning",
    name: "Takım Elbise",
    description: "Erkek ve bayan takım elbiseleri",
    basePrice: 35.0,
    unit: "adet",
    category: "Giyim",
    sortOrder: 1,
  },
  {
    businessTypeName: "dry_cleaning",
    name: "Elbise",
    description: "Abiye ve günlük elbiseler",
    basePrice: 25.0,
    unit: "adet",
    category: "Giyim",
    sortOrder: 2,
  },
  {
    businessTypeName: "dry_cleaning",
    name: "Palto/Mont",
    description: "Kış paltoları ve montlar",
    basePrice: 45.0,
    unit: "adet",
    category: "Dış Giyim",
    sortOrder: 3,
  },
];

const serviceTemplatesData = [
  // Carpet Cleaning Services
  {
    businessTypeName: "carpet_cleaning",
    name: "Standart Yıkama",
    description: "Temel halı yıkama servisi",
    basePrice: 0.0, // Base price included in product
    duration: 240, // 4 hours
    category: "Yıkama",
    sortOrder: 1,
  },
  {
    businessTypeName: "carpet_cleaning",
    name: "Derin Temizlik",
    description: "Antibakteriyel derin temizlik",
    basePrice: 5.0,
    duration: 360, // 6 hours
    category: "Özel Temizlik",
    sortOrder: 2,
  },
  {
    businessTypeName: "carpet_cleaning",
    name: "Leke Çıkarma",
    description: "İnatçı leke temizleme hizmeti",
    basePrice: 10.0,
    duration: 120, // 2 hours
    category: "Özel İşlem",
    sortOrder: 3,
  },

  // Dry Cleaning Services
  {
    businessTypeName: "dry_cleaning",
    name: "Standart Temizlik",
    description: "Genel kuru temizleme",
    basePrice: 0.0,
    duration: 180, // 3 hours
    category: "Temizlik",
    sortOrder: 1,
  },
  {
    businessTypeName: "dry_cleaning",
    name: "Express Servis",
    description: "Aynı gün teslimat",
    basePrice: 15.0,
    duration: 60, // 1 hour
    category: "Hızlı Servis",
    sortOrder: 2,
  },
  {
    businessTypeName: "dry_cleaning",
    name: "Ütü Servisi",
    description: "Profesyonel ütü ve paketleme",
    basePrice: 8.0,
    duration: 30, // 30 minutes
    category: "Ek Servis",
    sortOrder: 3,
  },
];

async function seedBusinessTypes() {
  console.log("🌱 Business Types seed verisi ekleniyor...");

  try {
    // 1. Business Types'ları seed et
    const businessTypes = {};
    for (const btData of businessTypesData) {
      const businessType = await prisma.businessType.upsert({
        where: { name: btData.name },
        update: {
          displayName: btData.displayName,
          description: btData.description,
          icon: btData.icon,
          color: btData.color,
          sortOrder: btData.sortOrder,
          isActive: true,
        },
        create: btData,
      });

      businessTypes[btData.name] = businessType;
      console.log(`✅ Business Type created: ${businessType.displayName}`);
    }

    // 2. Product Templates'leri seed et
    for (const ptData of productTemplatesData) {
      const businessType = businessTypes[ptData.businessTypeName];
      if (!businessType) {
        console.error(`❌ Business Type not found: ${ptData.businessTypeName}`);
        continue;
      }

      // Check if product template already exists
      const existingProduct = await prisma.productTemplate.findFirst({
        where: {
          businessTypeId: businessType.id,
          name: ptData.name,
        },
      });

      let productTemplate;
      if (existingProduct) {
        productTemplate = await prisma.productTemplate.update({
          where: { id: existingProduct.id },
          data: {
            description: ptData.description,
            basePrice: ptData.basePrice,
            unit: ptData.unit,
            category: ptData.category,
            sortOrder: ptData.sortOrder,
          },
        });
      } else {
        productTemplate = await prisma.productTemplate.create({
          data: {
            businessTypeId: businessType.id,
            name: ptData.name,
            description: ptData.description,
            basePrice: ptData.basePrice,
            unit: ptData.unit,
            category: ptData.category,
            sortOrder: ptData.sortOrder,
          },
        });
      }

      console.log(
        `✅ Product Template created: ${ptData.name} for ${businessType.displayName}`
      );
    }

    // 3. Service Templates'leri seed et
    for (const stData of serviceTemplatesData) {
      const businessType = businessTypes[stData.businessTypeName];
      if (!businessType) {
        console.error(`❌ Business Type not found: ${stData.businessTypeName}`);
        continue;
      }

      // Check if service template already exists
      const existingService = await prisma.serviceTemplate.findFirst({
        where: {
          businessTypeId: businessType.id,
          name: stData.name,
        },
      });

      let serviceTemplate;
      if (existingService) {
        serviceTemplate = await prisma.serviceTemplate.update({
          where: { id: existingService.id },
          data: {
            description: stData.description,
            basePrice: stData.basePrice,
            duration: stData.duration,
            category: stData.category,
            sortOrder: stData.sortOrder,
          },
        });
      } else {
        serviceTemplate = await prisma.serviceTemplate.create({
          data: {
            businessTypeId: businessType.id,
            name: stData.name,
            description: stData.description,
            basePrice: stData.basePrice,
            duration: stData.duration,
            category: stData.category,
            sortOrder: stData.sortOrder,
          },
        });
      }

      console.log(
        `✅ Service Template created: ${stData.name} for ${businessType.displayName}`
      );
    }

    console.log("🎉 Business Types seed işlemi başarıyla tamamlandı!");

    return {
      businessTypesCount: Object.keys(businessTypes).length,
      productTemplatesCount: productTemplatesData.length,
      serviceTemplatesCount: serviceTemplatesData.length,
    };
  } catch (error) {
    console.error("❌ Business Types seed hatası:", error);
    throw error;
  }
}

// Eğer direkt çalıştırılıyorsa seed'i başlat
if (require.main === module) {
  seedBusinessTypes()
    .then((result) => {
      console.log("📊 Seed İstatistikleri:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seed işlemi başarısız:", error);
      process.exit(1);
    });
}

module.exports = seedBusinessTypes;
