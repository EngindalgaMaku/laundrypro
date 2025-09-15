const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ========== BUSINESS CUSTOMIZATION MANAGEMENT ==========

// GET /business-customizations - Get all business customizations (ADMIN/SUPER_ADMIN only)
router.get("/", auth, async (req, res) => {
  try {
    const { role } = req.user;

    // Only ADMIN/SUPER_ADMIN can view all customizations
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Bu işlem için yönetici yetkisi gereklidir",
      });
    }

    const customizations = await prisma.businessCustomization.findMany({
      include: {
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
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      message: "İş özelleştirmeleri başarıyla alındı",
      data: {
        customizations,
        count: customizations.length,
      },
    });
  } catch (error) {
    console.error("Business customizations fetch error:", error);
    res.status(500).json({
      success: false,
      message: "İş özelleştirmeleri alınırken hata oluştu",
      error: error.message,
    });
  }
});

// GET /business-customizations/my - Get current tenant's customizations
router.get("/my", auth, async (req, res) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID bulunamadı",
      });
    }

    const customizations = await prisma.businessCustomization.findMany({
      where: {
        tenantId: tenantId,
      },
      include: {
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
      orderBy: {
        category: "asc",
      },
    });

    res.status(200).json({
      success: true,
      message: "İş özelleştirmeleri başarıyla alındı",
      data: {
        customizations,
        count: customizations.length,
      },
    });
  } catch (error) {
    console.error("My business customizations fetch error:", error);
    res.status(500).json({
      success: false,
      message: "İş özelleştirmeleri alınırken hata oluştu",
      error: error.message,
    });
  }
});

// GET /business-customizations/category/:category - Get customizations by category
router.get("/category/:category", auth, async (req, res) => {
  try {
    const { category } = req.params;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID bulunamadı",
      });
    }

    const customizations = await prisma.businessCustomization.findMany({
      where: {
        tenantId: tenantId,
        category: category,
      },
      include: {
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
      orderBy: {
        key: "asc",
      },
    });

    res.status(200).json({
      success: true,
      message: `${category} kategorisi özelleştirmeleri başarıyla alındı`,
      data: {
        category,
        customizations,
        count: customizations.length,
      },
    });
  } catch (error) {
    console.error("Business customizations by category fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Kategori özelleştirmeleri alınırken hata oluştu",
      error: error.message,
    });
  }
});

// GET /business-customizations/:id - Get single customization
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, role } = req.user;

    const customization = await prisma.businessCustomization.findUnique({
      where: { id },
      include: {
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
    });

    if (!customization) {
      return res.status(404).json({
        success: false,
        message: "Özelleştirme bulunamadı",
      });
    }

    // Check access permissions
    if (
      role !== "ADMIN" &&
      role !== "SUPER_ADMIN" &&
      customization.tenantId !== tenantId
    ) {
      return res.status(403).json({
        success: false,
        message: "Bu özelleştirmeye erişim yetkiniz yok",
      });
    }

    res.status(200).json({
      success: true,
      message: "Özelleştirme başarıyla alındı",
      data: customization,
    });
  } catch (error) {
    console.error("Business customization fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Özelleştirme alınırken hata oluştu",
      error: error.message,
    });
  }
});

// POST /business-customizations - Create new customization
router.post("/", auth, async (req, res) => {
  try {
    const { category, key, value, description, isActive } = req.body;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID bulunamadı",
      });
    }

    // Validate required fields
    if (!category || !key || value === undefined) {
      return res.status(400).json({
        success: false,
        message: "Kategori, anahtar ve değer alanları zorunludur",
      });
    }

    // Check if customization already exists for this tenant
    const existingCustomization = await prisma.businessCustomization.findFirst({
      where: {
        tenantId: tenantId,
        category: category,
        key: key,
      },
    });

    if (existingCustomization) {
      return res.status(409).json({
        success: false,
        message: "Bu kategori ve anahtar için özelleştirme zaten mevcut",
      });
    }

    const customization = await prisma.businessCustomization.create({
      data: {
        tenantId,
        category,
        key,
        value,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
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
    });

    res.status(201).json({
      success: true,
      message: "İş özelleştirmesi başarıyla oluşturuldu",
      data: customization,
    });
  } catch (error) {
    console.error("Business customization creation error:", error);
    res.status(500).json({
      success: false,
      message: "İş özelleştirmesi oluşturulurken hata oluştu",
      error: error.message,
    });
  }
});

// PUT /business-customizations/:id - Update customization
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, key, value, description, isActive } = req.body;
    const { tenantId, role } = req.user;

    // Check if customization exists
    const existingCustomization = await prisma.businessCustomization.findUnique(
      {
        where: { id },
      }
    );

    if (!existingCustomization) {
      return res.status(404).json({
        success: false,
        message: "Özelleştirme bulunamadı",
      });
    }

    // Check access permissions
    if (
      role !== "ADMIN" &&
      role !== "SUPER_ADMIN" &&
      existingCustomization.tenantId !== tenantId
    ) {
      return res.status(403).json({
        success: false,
        message: "Bu özelleştirmeyi güncelleme yetkiniz yok",
      });
    }

    // Build update data
    const updateData = {};
    if (category !== undefined) updateData.category = category;
    if (key !== undefined) updateData.key = key;
    if (value !== undefined) updateData.value = value;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Check for duplicate if category/key is changing
    if (
      (category && category !== existingCustomization.category) ||
      (key && key !== existingCustomization.key)
    ) {
      const duplicateCustomization =
        await prisma.businessCustomization.findFirst({
          where: {
            id: { not: id },
            tenantId: existingCustomization.tenantId,
            category: category || existingCustomization.category,
            key: key || existingCustomization.key,
          },
        });

      if (duplicateCustomization) {
        return res.status(409).json({
          success: false,
          message: "Bu kategori ve anahtar için özelleştirme zaten mevcut",
        });
      }
    }

    const updatedCustomization = await prisma.businessCustomization.update({
      where: { id },
      data: updateData,
      include: {
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
    });

    res.status(200).json({
      success: true,
      message: "İş özelleştirmesi başarıyla güncellendi",
      data: updatedCustomization,
    });
  } catch (error) {
    console.error("Business customization update error:", error);
    res.status(500).json({
      success: false,
      message: "İş özelleştirmesi güncellenirken hata oluştu",
      error: error.message,
    });
  }
});

// DELETE /business-customizations/:id - Delete customization
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, role } = req.user;

    // Check if customization exists
    const existingCustomization = await prisma.businessCustomization.findUnique(
      {
        where: { id },
      }
    );

    if (!existingCustomization) {
      return res.status(404).json({
        success: false,
        message: "Özelleştirme bulunamadı",
      });
    }

    // Check access permissions
    if (
      role !== "ADMIN" &&
      role !== "SUPER_ADMIN" &&
      existingCustomization.tenantId !== tenantId
    ) {
      return res.status(403).json({
        success: false,
        message: "Bu özelleştirmeyi silme yetkiniz yok",
      });
    }

    await prisma.businessCustomization.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "İş özelleştirmesi başarıyla silindi",
    });
  } catch (error) {
    console.error("Business customization deletion error:", error);
    res.status(500).json({
      success: false,
      message: "İş özelleştirmesi silinirken hata oluştu",
      error: error.message,
    });
  }
});

// POST /business-customizations/bulk - Bulk create/update customizations
router.post("/bulk", auth, async (req, res) => {
  try {
    const { customizations } = req.body;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID bulunamadı",
      });
    }

    if (!Array.isArray(customizations) || customizations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Geçerli bir özelleştirmeler listesi gereklidir",
      });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < customizations.length; i++) {
      const customization = customizations[i];
      const { category, key, value, description, isActive } = customization;

      try {
        // Validate required fields
        if (!category || !key || value === undefined) {
          errors.push({
            index: i,
            error: "Kategori, anahtar ve değer alanları zorunludur",
          });
          continue;
        }

        // Check if customization exists
        const existingCustomization =
          await prisma.businessCustomization.findFirst({
            where: {
              tenantId: tenantId,
              category: category,
              key: key,
            },
          });

        let result;
        if (existingCustomization) {
          // Update existing
          result = await prisma.businessCustomization.update({
            where: { id: existingCustomization.id },
            data: {
              value,
              description: description || existingCustomization.description,
              isActive:
                isActive !== undefined
                  ? isActive
                  : existingCustomization.isActive,
            },
          });
        } else {
          // Create new
          result = await prisma.businessCustomization.create({
            data: {
              tenantId,
              category,
              key,
              value,
              description: description || null,
              isActive: isActive !== undefined ? isActive : true,
            },
          });
        }

        results.push(result);
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Toplu özelleştirme işlemi tamamlandı",
      data: {
        successful: results,
        errors: errors,
        successCount: results.length,
        errorCount: errors.length,
      },
    });
  } catch (error) {
    console.error("Bulk business customization error:", error);
    res.status(500).json({
      success: false,
      message: "Toplu özelleştirme işlemi sırasında hata oluştu",
      error: error.message,
    });
  }
});

// GET /business-customizations/export/json - Export customizations as JSON
router.get("/export/json", auth, async (req, res) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID bulunamadı",
      });
    }

    const customizations = await prisma.businessCustomization.findMany({
      where: {
        tenantId: tenantId,
      },
      select: {
        category: true,
        key: true,
        value: true,
        description: true,
        isActive: true,
      },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=business-customizations.json"
    );

    res.status(200).json({
      success: true,
      message: "İş özelleştirmeleri başarıyla dışa aktarıldı",
      data: customizations,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Business customizations export error:", error);
    res.status(500).json({
      success: false,
      message: "İş özelleştirmeleri dışa aktarılırken hata oluştu",
      error: error.message,
    });
  }
});

module.exports = router;
