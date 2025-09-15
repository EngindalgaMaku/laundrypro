const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const { validateTenant } = require("../middleware/tenant");

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication and tenant validation to all routes
router.use(authenticateToken);
router.use(validateTenant);

/**
 * @route GET /api/product-catalog/global
 * @desc Get global product catalog (shared products)
 */
router.get("/global", async (req, res) => {
  try {
    const {
      businessTypeId,
      category,
      page = 1,
      limit = 50,
      search,
    } = req.query;

    const where = {
      isGlobal: true,
      isActive: true,
    };

    if (businessTypeId) {
      where.businessTypeId = businessTypeId;
    }

    if (category) {
      where.category = {
        contains: category,
        mode: "insensitive",
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.productTemplate.findMany({
        where,
        include: {
          businessType: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              tenantCustomizations: true,
            },
          },
        },
        orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.productTemplate.count({ where }),
    ]);

    const productCatalog = products.map((product) => ({
      ...product,
      usageCount: product._count.tenantCustomizations,
      canCustomize: true,
    }));

    res.json({
      success: true,
      data: {
        products: productCatalog,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching global product catalog:", error);
    res.status(500).json({
      success: false,
      message: "Küresel ürün kataloğu getirilirken hata oluştu",
      error: error.message,
    });
  }
});

/**
 * @route GET /api/product-catalog/my-catalog
 * @desc Get tenant's customized product catalog
 */
router.get("/my-catalog", async (req, res) => {
  try {
    const {
      category,
      page = 1,
      limit = 50,
      search,
      status = "active",
    } = req.query;
    const tenantId = req.user.tenantId;

    const where = {
      tenantId,
    };

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    if (category) {
      where.OR = [
        { customCategory: { contains: category, mode: "insensitive" } },
        {
          productTemplate: {
            category: { contains: category, mode: "insensitive" },
          },
        },
      ];
    }

    if (search) {
      where.OR = [
        { customName: { contains: search, mode: "insensitive" } },
        { customDescription: { contains: search, mode: "insensitive" } },
        {
          productTemplate: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const [customizations, total] = await Promise.all([
      prisma.productCatalogCustomization.findMany({
        where,
        include: {
          productTemplate: {
            include: {
              businessType: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              businessType: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.productCatalogCustomization.count({ where }),
    ]);

    const catalogItems = customizations.map((customization) => ({
      id: customization.id,
      templateId: customization.productTemplateId,
      name: customization.customName || customization.productTemplate.name,
      description:
        customization.customDescription ||
        customization.productTemplate.description,
      category:
        customization.customCategory || customization.productTemplate.category,
      price:
        customization.customPrice || customization.productTemplate.basePrice,
      unit: customization.customUnit || customization.productTemplate.unit,
      isActive: customization.isActive,
      isCustomized: !!(
        customization.customName ||
        customization.customPrice ||
        customization.customDescription
      ),
      customFields: customization.customFields,
      template: {
        id: customization.productTemplate.id,
        name: customization.productTemplate.name,
        description: customization.productTemplate.description,
        basePrice: customization.productTemplate.basePrice,
        category: customization.productTemplate.category,
        businessType: customization.productTemplate.businessType,
      },
      businessType: customization.tenant.businessType,
      createdAt: customization.createdAt,
      updatedAt: customization.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        catalog: catalogItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        stats: {
          total,
          active: customizations.filter((c) => c.isActive).length,
          customized: customizations.filter(
            (c) => c.customName || c.customPrice || c.customDescription
          ).length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching tenant product catalog:", error);
    res.status(500).json({
      success: false,
      message: "Ürün kataloğu getirilirken hata oluştu",
      error: error.message,
    });
  }
});

/**
 * @route POST /api/product-catalog/adopt
 * @desc Adopt a global product to tenant catalog
 */
router.post("/adopt", async (req, res) => {
  try {
    const {
      productTemplateId,
      customName,
      customDescription,
      customPrice,
      customCategory,
      customUnit,
      customFields,
      isActive = true,
    } = req.body;

    const tenantId = req.user.tenantId;

    // Check if product template exists
    const template = await prisma.productTemplate.findUnique({
      where: { id: productTemplateId },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Ürün şablonu bulunamadı",
      });
    }

    // Check if already adopted
    const existing = await prisma.productCatalogCustomization.findFirst({
      where: {
        tenantId,
        productTemplateId,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Bu ürün zaten kataloğunuzda mevcut",
      });
    }

    // Create customization
    const customization = await prisma.productCatalogCustomization.create({
      data: {
        tenantId,
        productTemplateId,
        customName,
        customDescription,
        customPrice: customPrice ? parseFloat(customPrice) : null,
        customCategory,
        customUnit,
        customFields: customFields || {},
        isActive,
      },
      include: {
        productTemplate: {
          include: {
            businessType: true,
          },
        },
        tenant: {
          include: {
            businessType: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Ürün kataloğa başarıyla eklendi",
      data: {
        id: customization.id,
        name: customization.customName || customization.productTemplate.name,
        description:
          customization.customDescription ||
          customization.productTemplate.description,
        price:
          customization.customPrice || customization.productTemplate.basePrice,
        category:
          customization.customCategory ||
          customization.productTemplate.category,
        isCustomized: !!(
          customization.customName ||
          customization.customPrice ||
          customization.customDescription
        ),
        template: customization.productTemplate,
      },
    });
  } catch (error) {
    console.error("Error adopting product:", error);
    res.status(500).json({
      success: false,
      message: "Ürün kataloğa eklenirken hata oluştu",
      error: error.message,
    });
  }
});

/**
 * @route PUT /api/product-catalog/customize/:id
 * @desc Update product customization
 */
router.put("/customize/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customName,
      customDescription,
      customPrice,
      customCategory,
      customUnit,
      customFields,
      isActive,
    } = req.body;

    const tenantId = req.user.tenantId;

    // Check if customization exists and belongs to tenant
    const existing = await prisma.productCatalogCustomization.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Ürün özelleştirmesi bulunamadı",
      });
    }

    // Update customization
    const updated = await prisma.productCatalogCustomization.update({
      where: { id },
      data: {
        customName,
        customDescription,
        customPrice: customPrice ? parseFloat(customPrice) : null,
        customCategory,
        customUnit,
        customFields: customFields || existing.customFields,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
      include: {
        productTemplate: {
          include: {
            businessType: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: "Ürün özelleştirmesi güncellendi",
      data: {
        id: updated.id,
        name: updated.customName || updated.productTemplate.name,
        description:
          updated.customDescription || updated.productTemplate.description,
        price: updated.customPrice || updated.productTemplate.basePrice,
        category: updated.customCategory || updated.productTemplate.category,
        isCustomized: !!(
          updated.customName ||
          updated.customPrice ||
          updated.customDescription
        ),
        isActive: updated.isActive,
        template: updated.productTemplate,
      },
    });
  } catch (error) {
    console.error("Error updating product customization:", error);
    res.status(500).json({
      success: false,
      message: "Ürün özelleştirmesi güncellenirken hata oluştu",
      error: error.message,
    });
  }
});

/**
 * @route DELETE /api/product-catalog/remove/:id
 * @desc Remove product from tenant catalog
 */
router.delete("/remove/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    // Check if customization exists and belongs to tenant
    const existing = await prisma.productCatalogCustomization.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Ürün özelleştirmesi bulunamadı",
      });
    }

    // Delete customization
    await prisma.productCatalogCustomization.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Ürün katalogdan kaldırıldı",
    });
  } catch (error) {
    console.error("Error removing product from catalog:", error);
    res.status(500).json({
      success: false,
      message: "Ürün katalogdan kaldırılırken hata oluştu",
      error: error.message,
    });
  }
});

/**
 * @route POST /api/product-catalog/bulk-adopt
 * @desc Bulk adopt products from business type template
 */
router.post("/bulk-adopt", async (req, res) => {
  try {
    const {
      businessTypeId,
      productIds,
      applyDefaultCustomizations = true,
    } = req.body;
    const tenantId = req.user.tenantId;

    if (!businessTypeId) {
      return res.status(400).json({
        success: false,
        message: "İş türü ID'si gerekli",
      });
    }

    // Get products to adopt
    const where = {
      businessTypeId,
      isGlobal: true,
      isActive: true,
    };

    if (productIds && productIds.length > 0) {
      where.id = { in: productIds };
    }

    const products = await prisma.productTemplate.findMany({
      where,
    });

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Adopte edilecek ürün bulunamadı",
      });
    }

    // Check for existing customizations
    const existingCustomizations =
      await prisma.productCatalogCustomization.findMany({
        where: {
          tenantId,
          productTemplateId: { in: products.map((p) => p.id) },
        },
        select: { productTemplateId: true },
      });

    const existingIds = new Set(
      existingCustomizations.map((c) => c.productTemplateId)
    );
    const productsToAdopt = products.filter((p) => !existingIds.has(p.id));

    if (productsToAdopt.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Seçilen tüm ürünler zaten kataloğunuzda mevcut",
      });
    }

    // Create customizations
    const customizations = await prisma.productCatalogCustomization.createMany({
      data: productsToAdopt.map((product) => ({
        tenantId,
        productTemplateId: product.id,
        customName: applyDefaultCustomizations ? null : product.name,
        customDescription: applyDefaultCustomizations
          ? null
          : product.description,
        customPrice: applyDefaultCustomizations ? null : product.basePrice,
        customCategory: applyDefaultCustomizations ? null : product.category,
        customUnit: applyDefaultCustomizations ? null : product.unit,
        customFields: {},
        isActive: true,
      })),
    });

    res.status(201).json({
      success: true,
      message: `${productsToAdopt.length} ürün kataloğa başarıyla eklendi`,
      data: {
        adoptedCount: productsToAdopt.length,
        skippedCount: products.length - productsToAdopt.length,
        totalAttempted: products.length,
      },
    });
  } catch (error) {
    console.error("Error bulk adopting products:", error);
    res.status(500).json({
      success: false,
      message: "Ürünler kataloga eklenirken hata oluştu",
      error: error.message,
    });
  }
});

/**
 * @route GET /api/product-catalog/business-type-templates
 * @desc Get available business type product templates
 */
router.get("/business-type-templates", async (req, res) => {
  try {
    const businessTypes = await prisma.businessType.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            productTemplates: {
              where: {
                isGlobal: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const templates = businessTypes.map((businessType) => ({
      id: businessType.id,
      name: businessType.name,
      slug: businessType.slug,
      description: businessType.description,
      icon: businessType.icon,
      productCount: businessType._count.productTemplates,
      features: businessType.features,
    }));

    res.json({
      success: true,
      data: { businessTypes: templates },
    });
  } catch (error) {
    console.error("Error fetching business type templates:", error);
    res.status(500).json({
      success: false,
      message: "İş türü şablonları getirilirken hata oluştu",
      error: error.message,
    });
  }
});

/**
 * @route GET /api/product-catalog/export
 * @desc Export tenant's product catalog
 */
router.get("/export", async (req, res) => {
  try {
    const { format = "json" } = req.query;
    const tenantId = req.user.tenantId;

    const customizations = await prisma.productCatalogCustomization.findMany({
      where: { tenantId },
      include: {
        productTemplate: {
          include: {
            businessType: true,
          },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { customCategory: "asc" },
        { customName: "asc" },
      ],
    });

    const exportData = {
      exportDate: new Date().toISOString(),
      tenantId,
      totalProducts: customizations.length,
      products: customizations.map((customization) => ({
        id: customization.id,
        templateId: customization.productTemplateId,
        name: customization.customName || customization.productTemplate.name,
        description:
          customization.customDescription ||
          customization.productTemplate.description,
        category:
          customization.customCategory ||
          customization.productTemplate.category,
        price:
          customization.customPrice || customization.productTemplate.basePrice,
        unit: customization.customUnit || customization.productTemplate.unit,
        isActive: customization.isActive,
        customFields: customization.customFields,
        businessType: customization.productTemplate.businessType.name,
        createdAt: customization.createdAt,
        updatedAt: customization.updatedAt,
      })),
    };

    if (format === "csv") {
      // Convert to CSV format
      const csv = require("csv-stringify/sync");
      const csvData = csv(exportData.products, {
        header: true,
        columns: [
          "name",
          "description",
          "category",
          "price",
          "unit",
          "isActive",
          "businessType",
        ],
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="product-catalog.csv"'
      );
      res.send(csvData);
    } else {
      res.json({
        success: true,
        data: exportData,
      });
    }
  } catch (error) {
    console.error("Error exporting product catalog:", error);
    res.status(500).json({
      success: false,
      message: "Ürün kataloğu dışa aktarılırken hata oluştu",
      error: error.message,
    });
  }
});

module.exports = router;
