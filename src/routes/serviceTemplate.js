const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth, requireRole } = require("../middleware/auth");
const router = express.Router();
const prisma = new PrismaClient();

// GET - Tüm service templates'leri listele (business type'a göre filtrelenmiş)
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

    const serviceTemplates = await prisma.serviceTemplate.findMany({
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
            // Future: orders, service bookings using this template
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    res.status(200).json({
      success: true,
      data: {
        serviceTemplates: serviceTemplates.map((template) => ({
          id: template.id,
          businessTypeId: template.businessTypeId,
          name: template.name,
          description: template.description,
          basePrice: template.basePrice,
          duration: template.duration,
          category: template.category,
          isActive: template.isActive,
          isRequired: template.isRequired,
          sortOrder: template.sortOrder,
          requirements: template.requirements,
          businessType: template.businessType,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          // Future: usage statistics
          usageCount: 0,
        })),
      },
      meta: {
        total: serviceTemplates.length,
        filters: { businessTypeId, category, isActive },
      },
    });
  } catch (error) {
    console.error("Service templates listesi alınamadı:", error);
    res.status(500).json({
      success: false,
      message: "Service templates listesi alınamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET - Belirli bir service template detayları
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const serviceTemplate = await prisma.serviceTemplate.findUnique({
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

    if (!serviceTemplate) {
      return res.status(404).json({
        success: false,
        message: "Service template bulunamadı",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        serviceTemplate: {
          id: serviceTemplate.id,
          businessTypeId: serviceTemplate.businessTypeId,
          name: serviceTemplate.name,
          description: serviceTemplate.description,
          basePrice: serviceTemplate.basePrice,
          duration: serviceTemplate.duration,
          category: serviceTemplate.category,
          isActive: serviceTemplate.isActive,
          isRequired: serviceTemplate.isRequired,
          sortOrder: serviceTemplate.sortOrder,
          requirements: serviceTemplate.requirements,
          businessType: serviceTemplate.businessType,
          createdAt: serviceTemplate.createdAt,
          updatedAt: serviceTemplate.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Service template detayları alınamadı:", error);
    res.status(500).json({
      success: false,
      message: "Service template detayları alınamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST - Yeni service template oluştur (SUPER_ADMIN only)
router.post("/", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const {
      businessTypeId,
      name,
      description,
      basePrice,
      duration,
      category,
      isActive = true,
      isRequired = false,
      sortOrder = 0,
      requirements = {},
    } = req.body;

    // Validation
    if (
      !businessTypeId ||
      !name ||
      !description ||
      basePrice === undefined ||
      !duration
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Gerekli alanlar: businessTypeId, name, description, basePrice, duration",
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
    const existingTemplate = await prisma.serviceTemplate.findFirst({
      where: {
        businessTypeId,
        name: name.trim(),
      },
    });

    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        message:
          "Bu business type için aynı isimde service template zaten mevcut",
      });
    }

    // Yeni service template oluştur
    const serviceTemplate = await prisma.serviceTemplate.create({
      data: {
        businessTypeId,
        name: name.trim(),
        description: description.trim(),
        basePrice: parseFloat(basePrice),
        duration: parseInt(duration),
        category: category?.trim() || "GENEL",
        isActive,
        isRequired,
        sortOrder: parseInt(sortOrder) || 0,
        requirements: requirements || {},
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
      message: "Service template başarıyla oluşturuldu",
      data: {
        serviceTemplate: {
          id: serviceTemplate.id,
          businessTypeId: serviceTemplate.businessTypeId,
          name: serviceTemplate.name,
          description: serviceTemplate.description,
          basePrice: serviceTemplate.basePrice,
          duration: serviceTemplate.duration,
          category: serviceTemplate.category,
          isActive: serviceTemplate.isActive,
          isRequired: serviceTemplate.isRequired,
          sortOrder: serviceTemplate.sortOrder,
          requirements: serviceTemplate.requirements,
          businessType: serviceTemplate.businessType,
          createdAt: serviceTemplate.createdAt,
          updatedAt: serviceTemplate.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Service template oluşturulamadı:", error);
    res.status(500).json({
      success: false,
      message: "Service template oluşturulamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// PUT - Service template güncelle (SUPER_ADMIN only)
router.put("/:id", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      basePrice,
      duration,
      category,
      isActive,
      isRequired,
      sortOrder,
      requirements,
    } = req.body;

    // Mevcut template'i kontrol et
    const existingTemplate = await prisma.serviceTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: "Service template bulunamadı",
      });
    }

    // Eğer isim değişiyorsa, aynı business type'da aynı isimde başka template var mı kontrol et
    if (name && name.trim() !== existingTemplate.name) {
      const duplicateTemplate = await prisma.serviceTemplate.findFirst({
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
            "Bu business type için aynı isimde başka service template zaten mevcut",
        });
      }
    }

    // Update data hazırla
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (basePrice !== undefined) updateData.basePrice = parseFloat(basePrice);
    if (duration !== undefined) updateData.duration = parseInt(duration);
    if (category !== undefined) updateData.category = category.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
    if (requirements !== undefined) updateData.requirements = requirements;

    // Service template güncelle
    const serviceTemplate = await prisma.serviceTemplate.update({
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
      message: "Service template başarıyla güncellendi",
      data: {
        serviceTemplate: {
          id: serviceTemplate.id,
          businessTypeId: serviceTemplate.businessTypeId,
          name: serviceTemplate.name,
          description: serviceTemplate.description,
          basePrice: serviceTemplate.basePrice,
          duration: serviceTemplate.duration,
          category: serviceTemplate.category,
          isActive: serviceTemplate.isActive,
          isRequired: serviceTemplate.isRequired,
          sortOrder: serviceTemplate.sortOrder,
          requirements: serviceTemplate.requirements,
          businessType: serviceTemplate.businessType,
          createdAt: serviceTemplate.createdAt,
          updatedAt: serviceTemplate.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Service template güncellenemedi:", error);
    res.status(500).json({
      success: false,
      message: "Service template güncellenemedi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// DELETE - Service template sil (SUPER_ADMIN only)
router.delete("/:id", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    // Template var mı kontrol et
    const existingTemplate = await prisma.serviceTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: "Service template bulunamadı",
      });
    }

    // TODO: Future - Bu template'i kullanan service booking'ler varsa silinmesini engelle
    // const usageCheck = await prisma.serviceBooking.findFirst({
    //   where: { serviceTemplateId: id }
    // });

    // if (usageCheck) {
    //   return res.status(409).json({
    //     success: false,
    //     message: "Bu service template kullanımda olduğu için silinemez"
    //   });
    // }

    // Service template'i sil
    await prisma.serviceTemplate.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Service template başarıyla silindi",
    });
  } catch (error) {
    console.error("Service template silinemedi:", error);
    res.status(500).json({
      success: false,
      message: "Service template silinemedi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST - Service templates sıralamasını güncelle (SUPER_ADMIN only)
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
      prisma.serviceTemplate.update({
        where: { id },
        data: { sortOrder: index },
      })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Service template sıralaması başarıyla güncellendi",
    });
  } catch (error) {
    console.error("Service template sıralaması güncellenemedi:", error);
    res.status(500).json({
      success: false,
      message: "Service template sıralaması güncellenemedi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST - Service template durumunu değiştir (aktif/pasif)
router.post(
  "/:id/toggle-status",
  auth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const template = await prisma.serviceTemplate.findUnique({
        where: { id },
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Service template bulunamadı",
        });
      }

      const updatedTemplate = await prisma.serviceTemplate.update({
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
        message: `Service template ${
          updatedTemplate.isActive ? "aktif" : "pasif"
        } duruma getirildi`,
        data: {
          serviceTemplate: {
            id: updatedTemplate.id,
            name: updatedTemplate.name,
            isActive: updatedTemplate.isActive,
            businessType: updatedTemplate.businessType,
          },
        },
      });
    } catch (error) {
      console.error("Service template durumu değiştirilemedi:", error);
      res.status(500).json({
        success: false,
        message: "Service template durumu değiştirilemedi",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// GET - Service template kategorileri listele (business type'a göre)
router.get("/categories/:businessTypeId", auth, async (req, res) => {
  try {
    const { businessTypeId } = req.params;

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

    // Bu business type'a ait service template kategorilerini getir
    const categories = await prisma.serviceTemplate.groupBy({
      by: ["category"],
      where: {
        businessTypeId,
        isActive: true,
      },
      _count: {
        category: true,
      },
      orderBy: {
        category: "asc",
      },
    });

    res.status(200).json({
      success: true,
      data: {
        businessType: {
          id: businessType.id,
          name: businessType.name,
          displayName: businessType.displayName,
        },
        categories: categories.map((cat) => ({
          name: cat.category,
          count: cat._count.category,
        })),
      },
    });
  } catch (error) {
    console.error("Service template kategorileri alınamadı:", error);
    res.status(500).json({
      success: false,
      message: "Service template kategorileri alınamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
