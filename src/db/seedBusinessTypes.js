const { prisma } = require("../config/database");

const defaultBusinessTypes = [
  {
    name: "CARPET_CLEANING",
    displayName: "Halı & Koltuk Yıkama",
    description: "Halı, koltuk, perde ve ev tekstili yıkama hizmeti",
    icon: "home-account",
    color: "#6366F1",
    sortOrder: 1,
  },
  {
    name: "DRY_CLEANING",
    displayName: "Kuru Temizleme",
    description: "Kıyafet ve tekstil kuru temizleme hizmeti",
    icon: "tshirt-crew",
    color: "#10B981",
    sortOrder: 2,
  },
  {
    name: "LAUNDRY_SERVICE",
    displayName: "Çamaşırhane",
    description: "Genel çamaşır yıkama ve ütüleme hizmeti",
    icon: "washing-machine",
    color: "#06B6D4",
    sortOrder: 3,
  },
  {
    name: "SHOE_REPAIR",
    displayName: "Ayakkabı Tamiri",
    description: "Ayakkabı tamiri ve bakım hizmeti",
    icon: "shoe-formal",
    color: "#8B5CF6",
    sortOrder: 4,
  },
  {
    name: "LEATHER_CLEANING",
    displayName: "Deri Temizleme",
    description: "Deri ürünler temizleme ve bakım hizmeti",
    icon: "bag-personal",
    color: "#F59E0B",
    sortOrder: 5,
  },
  {
    name: "ALTERATION_SERVICE",
    displayName: "Terzi Hizmeti",
    description: "Kıyafet değişikliği ve terzi hizmeti",
    icon: "content-cut",
    color: "#EC4899",
    sortOrder: 6,
  },
  {
    name: "GENERAL_CLEANING",
    displayName: "Genel Temizlik",
    description: "Ev ve ofis genel temizlik hizmeti",
    icon: "broom",
    color: "#84CC16",
    sortOrder: 7,
  },
  {
    name: "OTHER",
    displayName: "Diğer",
    description: "Yukarıdaki kategorilere girmeyen özel hizmetler",
    icon: "dots-horizontal",
    color: "#6B7280",
    sortOrder: 99,
  },
];

const productTemplates = [
  // Halı & Koltuk Yıkama Templates
  {
    businessTypeName: "CARPET_CLEANING",
    name: "Halı Yıkama",
    description: "Genel halı yıkama hizmeti",
    basePrice: 15.0,
    unit: "m2",
    category: "Halı",
    isRequired: true,
    sortOrder: 1,
    attributes: {
      sizes: ["Küçük (1-5 m2)", "Orta (6-15 m2)", "Büyük (16+ m2)"],
      materials: ["Yün", "Akrilik", "Pamuk", "Sentetik"],
      services: [
        "Sadece Yıkama",
        "Yıkama + Dezenfektan",
        "Yıkama + Leke Çıkarma",
      ],
    },
  },
  {
    businessTypeName: "CARPET_CLEANING",
    name: "Koltuk Yıkama",
    description: "Koltuk ve kanepe yıkama hizmeti",
    basePrice: 25.0,
    unit: "adet",
    category: "Mobilya",
    sortOrder: 2,
    attributes: {
      types: ["Tekli Koltuk", "İkili Koltuk", "Üçlü Koltuk", "Köşe Takımı"],
      materials: ["Kumaş", "Deri", "Suni Deri"],
      services: ["Sadece Yıkama", "Yıkama + Koruma"],
    },
  },
  {
    businessTypeName: "CARPET_CLEANING",
    name: "Perde Yıkama",
    description: "Perde ve fon yıkama hizmeti",
    basePrice: 8.0,
    unit: "m2",
    category: "Perde",
    sortOrder: 3,
    attributes: {
      types: ["Klasik Perde", "Tül Perde", "Fon Perde", "Zebra Perde"],
      services: ["Yıkama", "Yıkama + Ütüleme", "Yıkama + Söküm/Takma"],
    },
  },

  // Kuru Temizleme Templates
  {
    businessTypeName: "DRY_CLEANING",
    name: "Takım Elbise",
    description: "Erkek/kadın takım elbise kuru temizleme",
    basePrice: 30.0,
    unit: "adet",
    category: "Resmi Giyim",
    isRequired: true,
    sortOrder: 1,
    attributes: {
      types: ["Erkek Takım", "Kadın Takım", "Blazer", "Pantolon"],
      services: ["Kuru Temizleme", "Kuru Temizleme + Ütü", "Express (24 Saat)"],
    },
  },
  {
    businessTypeName: "DRY_CLEANING",
    name: "Mont & Kaban",
    description: "Kış kıyafetleri kuru temizleme",
    basePrice: 40.0,
    unit: "adet",
    category: "Kış Giyim",
    sortOrder: 2,
    attributes: {
      types: ["Kaban", "Mont", "Yelek", "Kürk"],
      services: ["Kuru Temizleme", "Kuru Temizleme + Koruma"],
    },
  },

  // Çamaşırhane Templates
  {
    businessTypeName: "LAUNDRY_SERVICE",
    name: "Günlük Çamaşır",
    description: "Günlük giyim çamaşır yıkama",
    basePrice: 3.5,
    unit: "kg",
    category: "Günlük Giyim",
    isRequired: true,
    sortOrder: 1,
    attributes: {
      services: ["Yıkama", "Yıkama + Ütü", "Yıkama + Kurutma"],
      options: ["Normal", "Hassas", "Beyaz", "Renkli"],
    },
  },
  {
    businessTypeName: "LAUNDRY_SERVICE",
    name: "Yatak Takımı",
    description: "Nevresim, çarşaf, yastık kılıfı yıkama",
    basePrice: 15.0,
    unit: "takım",
    category: "Ev Tekstili",
    sortOrder: 2,
  },
];

const serviceTemplates = [
  // Genel Hizmetler
  {
    businessTypeName: "CARPET_CLEANING",
    name: "Evden Alma - Eve Teslim",
    description: "Ücretsiz evden alma ve eve teslim hizmeti",
    basePrice: 0.0,
    duration: 30,
    category: "Lojistik",
    sortOrder: 1,
  },
  {
    businessTypeName: "CARPET_CLEANING",
    name: "Express Hizmet",
    description: "24 saat içinde teslim (ek ücret)",
    basePrice: 20.0,
    duration: 0,
    category: "Hız",
    sortOrder: 2,
  },
  {
    businessTypeName: "DRY_CLEANING",
    name: "Leke Çıkarma",
    description: "Zorlu lekeler için özel işlem",
    basePrice: 10.0,
    duration: 60,
    category: "Özel İşlem",
    sortOrder: 1,
  },
  {
    businessTypeName: "LAUNDRY_SERVICE",
    name: "Antibakteriyel Yıkama",
    description: "Antibakteriyel dezenfektan ile yıkama",
    basePrice: 5.0,
    duration: 0,
    category: "Hijyen",
    sortOrder: 1,
  },
];

const pricingRules = [
  // Hacim indirimi kuralı
  {
    businessTypeName: "CARPET_CLEANING",
    name: "Hacim İndirimi",
    description: "50 m2 üzeri %10 indirim",
    ruleType: "VOLUME_DISCOUNT",
    conditions: {
      minQuantity: 50,
      unit: "m2",
      productCategories: ["Halı"],
    },
    calculation: {
      type: "percentage",
      value: 10,
      applyTo: "total",
    },
    priority: 1,
  },
  // Express hizmet ek ücreti
  {
    businessTypeName: "DRY_CLEANING",
    name: "Express Ücret",
    description: "24 saat hızlı teslimat %50 ek ücret",
    ruleType: "TIME_BASED",
    conditions: {
      serviceType: "express",
      deliveryHours: 24,
    },
    calculation: {
      type: "percentage",
      value: 50,
      applyTo: "total",
    },
    priority: 2,
  },
  // Müşteri sadakat indirimi
  {
    businessTypeName: "LAUNDRY_SERVICE",
    name: "Sadık Müşteri İndirimi",
    description: "10+ sipariş vermiş müşterilere %15 indirim",
    ruleType: "CUSTOMER_TIER",
    conditions: {
      minOrders: 10,
      customerTier: "loyal",
    },
    calculation: {
      type: "percentage",
      value: 15,
      applyTo: "total",
    },
    priority: 3,
  },
];

async function seedBusinessTypes() {
  try {
    console.log("🌱 Seeding business types...");

    // Create business types
    for (const businessType of defaultBusinessTypes) {
      const existingType = await prisma.businessType.findUnique({
        where: { name: businessType.name },
      });

      if (!existingType) {
        await prisma.businessType.create({
          data: businessType,
        });
        console.log(`✅ Created business type: ${businessType.displayName}`);
      } else {
        console.log(
          `⚠️  Business type already exists: ${businessType.displayName}`
        );
      }
    }

    // Create product templates
    console.log("\n🧩 Seeding product templates...");
    for (const template of productTemplates) {
      const businessType = await prisma.businessType.findUnique({
        where: { name: template.businessTypeName },
      });

      if (businessType) {
        const existingTemplate = await prisma.productTemplate.findFirst({
          where: {
            name: template.name,
            businessTypeId: businessType.id,
          },
        });

        if (!existingTemplate) {
          await prisma.productTemplate.create({
            data: {
              businessTypeId: businessType.id,
              name: template.name,
              description: template.description,
              basePrice: template.basePrice,
              unit: template.unit,
              category: template.category,
              isRequired: template.isRequired || false,
              sortOrder: template.sortOrder,
              attributes: template.attributes || {},
            },
          });
          console.log(
            `✅ Created product template: ${template.name} for ${template.businessTypeName}`
          );
        }
      }
    }

    // Create service templates
    console.log("\n🔧 Seeding service templates...");
    for (const template of serviceTemplates) {
      const businessType = await prisma.businessType.findUnique({
        where: { name: template.businessTypeName },
      });

      if (businessType) {
        const existingTemplate = await prisma.serviceTemplate.findFirst({
          where: {
            name: template.name,
            businessTypeId: businessType.id,
          },
        });

        if (!existingTemplate) {
          await prisma.serviceTemplate.create({
            data: {
              businessTypeId: businessType.id,
              name: template.name,
              description: template.description,
              basePrice: template.basePrice,
              duration: template.duration,
              category: template.category,
              sortOrder: template.sortOrder,
              requirements: template.requirements || {},
            },
          });
          console.log(
            `✅ Created service template: ${template.name} for ${template.businessTypeName}`
          );
        }
      }
    }

    // Create pricing rules
    console.log("\n💰 Seeding pricing rules...");
    for (const rule of pricingRules) {
      const businessType = await prisma.businessType.findUnique({
        where: { name: rule.businessTypeName },
      });

      if (businessType) {
        const existingRule = await prisma.pricingRule.findFirst({
          where: {
            name: rule.name,
            businessTypeId: businessType.id,
          },
        });

        if (!existingRule) {
          await prisma.pricingRule.create({
            data: {
              businessTypeId: businessType.id,
              name: rule.name,
              description: rule.description,
              ruleType: rule.ruleType,
              conditions: rule.conditions,
              calculation: rule.calculation,
              priority: rule.priority,
            },
          });
          console.log(
            `✅ Created pricing rule: ${rule.name} for ${rule.businessTypeName}`
          );
        }
      }
    }

    console.log("\n🎉 Business types seeding completed successfully!");

    // Display summary
    const typesCount = await prisma.businessType.count();
    const productTemplatesCount = await prisma.productTemplate.count();
    const serviceTemplatesCount = await prisma.serviceTemplate.count();
    const pricingRulesCount = await prisma.pricingRule.count();

    console.log("\n📊 Summary:");
    console.log(`  • Business Types: ${typesCount}`);
    console.log(`  • Product Templates: ${productTemplatesCount}`);
    console.log(`  • Service Templates: ${serviceTemplatesCount}`);
    console.log(`  • Pricing Rules: ${pricingRulesCount}`);
  } catch (error) {
    console.error("❌ Error seeding business types:", error);
    throw error;
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedBusinessTypes()
    .then(() => {
      console.log("✅ Seeding completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}

module.exports = { seedBusinessTypes };
