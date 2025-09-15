const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth, requireRole } = require("../middleware/auth");
const router = express.Router();
const prisma = new PrismaClient();

// GET - Tüm product templates'leri listele (business type'a göre filtrelenmiş)
router.get("/", auth, async (req, res) => {
  try {
    const { businessTypeId, category, isActive } = req.query;

    const filters = {};

    if (businessTypeId) {
      filters.businessTypeId = businessTypeId;
    }

    if (category) {
      filters.category = category;
    }

    if (isActive !== undefined) {
      filters.isActive = isActive === "true";
    }

    const productTemplates = await prisma.productTemplate.findMany({
      where: filters,
      include: {
        businessType: {
          select: {
            id: true,
            name: true,
            displayName: true,
            icon: true,
            color: true,
          },
        },
        _count: {
          select: {
            // Future: orders, inventory items using this template
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    res.status(200).json({
      success: true,
      data: {
        productTemplates: productTemplates.map((template) => ({
          id: template.id,
          businessTypeId: template.businessTypeId,
          name: template.name,
          description: template.description,
          basePrice: template.basePrice,
          unit: template.unit,
          category: template.category,
          isActive: template.isActive,
          isRequired: template.isRequired,
          sortOrder: template.sortOrder,
          attributes: template.attributes,
          businessType: template.businessType,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          // Future: usage statistics
          usageCount: 0,
        })),
      },
      meta: {
        total: productTemplates.length,
        filters: { businessTypeId, category, isActive },
      },
    });
  } catch (error) {
    console.error("Product templates listesi alınamadı:", error);
    res.status(500).json({
      success: false,
      message: "Product templates listesi alınamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET - Belirli bir product template detayları
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const productTemplate = await prisma.productTemplate.findUnique({
      where: { id },
      include: {
        businessType: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    if (!productTemplate) {
      return res.status(404).json({
        success: false,
        message: "Product template bulunamadı",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        productTemplate: {
          id: productTemplate.id,
          businessTypeId: productTemplate.businessTypeId,
          name: productTemplate.name,
          description: productTemplate.description,
          basePrice: productTemplate.basePrice,
          unit: productTemplate.unit,
          category: productTemplate.category,
          isActive: productTemplate.isActive,
          isRequired: productTemplate.isRequired,
          sortOrder: productTemplate.sortOrder,
          attributes: productTemplate.attributes,
          businessType: productTemplate.businessType,
          createdAt: productTemplate.createdAt,
          updatedAt: productTemplate.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Product template detayları alınamadı:", error);
    res.status(500).json({
      success: false,
      message: "Product template detayları alınamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST - Yeni product template oluştur (SUPER_ADMIN only)
router.post("/", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const {
      businessTypeId,
      name,
      description,
      basePrice,
      unit,
      category,
      isActive = true,
      isRequired = false,
      sortOrder = 0,
      attributes = {},
    } = req.body;

    // Validation
    if (
      !businessTypeId ||
      !name ||
      !description ||
      basePrice === undefined ||
      !unit
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Gerekli alanlar: businessTypeId, name, description, basePrice, unit",
      });
    }

    // Business type var mı kontrol et
    const businessType = await prisma.businessType.findUnique({
      where: { id: businessTypeId },
    });

    if (!businessType) {
      return res.status(404).json({
        success: false,
        message: "Business type bulunamadı",
      });
    }

    // Aynı isimde template var mı kontrol et
    const existingTemplate = await prisma.productTemplate.findFirst({
      where: {
        businessTypeId,
        name: name.trim(),
      },
    });

    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        message:
          "Bu business type için aynı isimde product template zaten mevcut",
      });
    }

    // Yeni product template oluştur
    const productTemplate = await prisma.productTemplate.create({
      data: {
        businessTypeId,
        name: name.trim(),
        description: description.trim(),
        basePrice: parseFloat(basePrice),
        unit: unit.trim(),
        category: category?.trim() || "GENEL",
        isActive,
        isRequired,
        sortOrder: parseInt(sortOrder) || 0,
        attributes: attributes || {},
      },
      include: {
        businessType: {
          select: {
            id: true,
            name: true,
            displayName: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Product template başarıyla oluşturuldu",
      data: {
        productTemplate: {
          id: productTemplate.id,
          businessTypeId: productTemplate.businessTypeId,
          name: productTemplate.name,
          description: productTemplate.description,
          basePrice: productTemplate.basePrice,
          unit: productTemplate.unit,
          category: productTemplate.category,
          isActive: productTemplate.isActive,
          isRequired: productTemplate.isRequired,
          sortOrder: productTemplate.sortOrder,
          attributes: productTemplate.attributes,
          businessType: productTemplate.businessType,
          createdAt: productTemplate.createdAt,
          updatedAt: productTemplate.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Product template oluşturulamadı:", error);
    res.status(500).json({
      success: false,
      message: "Product template oluşturulamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// PUT - Product template güncelle (SUPER_ADMIN only)
router.put("/:id", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      basePrice,
      unit,
      category,
      isActive,
      isRequired,
      sortOrder,
      attributes,
    } = req.body;

    // Mevcut template'i kontrol et
    const existingTemplate = await prisma.productTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: "Product template bulunamadı",
      });
    }

    // Eğer isim değişiyorsa, aynı business type'da aynı isimde başka template var mı kontrol et
    if (name && name.trim() !== existingTemplate.name) {
      const duplicateTemplate = await prisma.productTemplate.findFirst({
        where: {
          businessTypeId: existingTemplate.businessTypeId,
          name: name.trim(),
          id: { not: id },
        },
      });

      if (duplicateTemplate) {
        return res.status(409).json({
          success: false,
          message:
            "Bu business type için aynı isimde başka product template zaten mevcut",
        });
      }
    }

    // Update data hazırla
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (basePrice !== undefined) updateData.basePrice = parseFloat(basePrice);
    if (unit !== undefined) updateData.unit = unit.trim();
    if (category !== undefined) updateData.category = category.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
    if (attributes !== undefined) updateData.attributes = attributes;

    // Product template güncelle
    const productTemplate = await prisma.productTemplate.update({
      where: { id },
      data: updateData,
      include: {
        businessType: {
          select: {
            id: true,
            name: true,
            displayName: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Product template başarıyla güncellendi",
      data: {
        productTemplate: {
          id: productTemplate.id,
          businessTypeId: productTemplate.businessTypeId,
          name: productTemplate.name,
          description: productTemplate.description,
          basePrice: productTemplate.basePrice,
          unit: productTemplate.unit,
          category: productTemplate.category,
          isActive: productTemplate.isActive,
          isRequired: productTemplate.isRequired,
          sortOrder: productTemplate.sortOrder,
          attributes: productTemplate.attributes,
          businessType: productTemplate.businessType,
          createdAt: productTemplate.createdAt,
          updatedAt: productTemplate.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Product template güncellenemedi:", error);
    res.status(500).json({
      success: false,
      message: "Product template güncellenemedi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// DELETE - Product template sil (SUPER_ADMIN only)
router.delete("/:id", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    // Template var mı kontrol et
    const existingTemplate = await prisma.productTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: "Product template bulunamadı",
      });
    }

    // TODO: Future - Bu template'i kullanan order'lar varsa silinmesini engelle
    // const usageCheck = await prisma.orderItem.findFirst({
    //   where: { productTemplateId: id }
    // });

    // if (usageCheck) {
    //   return res.status(409).json({
    //     success: false,
    //     message: "Bu product template kullanımda olduğu için silinemez"
    //   });
    // }

    // Product template'i sil
    await prisma.productTemplate.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Product template başarıyla silindi",
    });
  } catch (error) {
    console.error("Product template silinemedi:", error);
    res.status(500).json({
      success: false,
      message: "Product template silinemedi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST - Product templates sıralamasını güncelle (SUPER_ADMIN only)
router.post("/reorder", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { templateIds } = req.body;

    if (!Array.isArray(templateIds) || templateIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "templateIds dizisi gereklidir",
      });
    }

    // Batch update ile sıralamaları güncelle
    const updatePromises = templateIds.map((id, index) =>
      prisma.productTemplate.update({
        where: { id },
        data: { sortOrder: index },
      })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Product template sıralaması başarıyla güncellendi",
    });
  } catch (error) {
    console.error("Product template sıralaması güncellenemedi:", error);
    res.status(500).json({
      success: false,
      message: "Product template sıralaması güncellenemedi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST - Product template durumunu değiştir (aktif/pasif)
router.post(
  "/:id/toggle-status",
  auth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const template = await prisma.productTemplate.findUnique({
        where: { id },
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Product template bulunamadı",
        });
      }

      const updatedTemplate = await prisma.productTemplate.update({
        where: { id },
        data: { isActive: !template.isActive },
        include: {
          businessType: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        message: `Product template ${
          updatedTemplate.isActive ? "aktif" : "pasif"
        } duruma getirildi`,
        data: {
          productTemplate: {
            id: updatedTemplate.id,
            name: updatedTemplate.name,
            isActive: updatedTemplate.isActive,
            businessType: updatedTemplate.businessType,
          },
        },
      });
    } catch (error) {
      console.error("Product template durumu değiştirilemedi:", error);
      res.status(500).json({
        success: false,
        message: "Product template durumu değiştirilemedi",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

module.exports = router;
