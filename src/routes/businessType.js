const express = require("express");
const { prisma } = require("../config/database");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/:appSlug/business-types
// @desc    Get all business types
// @access  Public (for registration form)
router.get("/", async (req, res) => {
  try {
    const businessTypes = await prisma.businessType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            tenantBusinessTypes: true,
            productTemplates: true,
            serviceTemplates: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { businessTypes },
    });
  } catch (error) {
    console.error("❌ Business types fetch error:", error);
    res.status(500).json({
      success: false,
      message: "İşletme türleri alınırken hata oluştu",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   GET /api/v1/:appSlug/business-types/admin/all
// @desc    Get all business types including inactive ones (for admin panel)
// @access  Private (SUPER_ADMIN, ADMIN)
router.get(
  "/admin/all",
  auth,
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    try {
      const businessTypes = await prisma.businessType.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          _count: {
            select: {
              tenantBusinessTypes: true,
              productTemplates: true,
              serviceTemplates: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: { businessTypes },
      });
    } catch (error) {
      console.error("❌ Admin business types fetch error:", error);
      res.status(500).json({
        success: false,
        message: "İşletme türleri alınırken hata oluştu",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// @route   GET /api/v1/:appSlug/business-types/:id
// @desc    Get single business type with templates
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const businessType = await prisma.businessType.findUnique({
      where: { id, isActive: true },
      include: {
        productTemplates: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        serviceTemplates: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        pricingRules: {
          where: { isActive: true },
          orderBy: { priority: "desc" },
        },
      },
    });

    if (!businessType) {
      return res.status(404).json({
        success: false,
        message: "İşletme türü bulunamadı",
      });
    }

    res.json({
      success: true,
      data: { businessType },
    });
  } catch (error) {
    console.error("❌ Business type fetch error:", error);
    res.status(500).json({
      success: false,
      message: "İşletme türü alınırken hata oluştu",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/:appSlug/business-types
// @desc    Create business type (Admin only)
// @access  Private (SUPER_ADMIN)
router.post("/", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const {
      name,
      displayName,
      description,
      icon,
      color,
      sortOrder = 0,
    } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: "İşletme türü adı ve görünen adı gereklidir",
      });
    }

    // Check if business type name already exists
    const existingBusinessType = await prisma.businessType.findUnique({
      where: { name },
    });

    if (existingBusinessType) {
      return res.status(400).json({
        success: false,
        message: "Bu işletme türü adı zaten kullanılıyor",
      });
    }

    const businessType = await prisma.businessType.create({
      data: {
        name,
        displayName,
        description,
        icon,
        color,
        sortOrder,
      },
    });

    console.log("✅ Business type created:", businessType.name);

    res.status(201).json({
      success: true,
      message: "İşletme türü başarıyla oluşturuldu",
      data: { businessType },
    });
  } catch (error) {
    console.error("❌ Business type creation error:", error);
    res.status(500).json({
      success: false,
      message: "İşletme türü oluşturulurken hata oluştu",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   PUT /api/v1/:appSlug/business-types/:id
// @desc    Update business type (Admin only)
// @access  Private (SUPER_ADMIN)
router.put("/:id", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, displayName, description, icon, color, sortOrder, isActive } =
      req.body;

    // Check if business type exists
    const existingBusinessType = await prisma.businessType.findUnique({
      where: { id },
    });

    if (!existingBusinessType) {
      return res.status(404).json({
        success: false,
        message: "İşletme türü bulunamadı",
      });
    }

    // Check if name is being changed and already exists
    if (name && name !== existingBusinessType.name) {
      const nameExists = await prisma.businessType.findUnique({
        where: { name },
      });

      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: "Bu işletme türü adı zaten kullanılıyor",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (displayName !== undefined) updateData.displayName = displayName;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedBusinessType = await prisma.businessType.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            tenantBusinessTypes: true,
            productTemplates: true,
            serviceTemplates: true,
          },
        },
      },
    });

    console.log("✅ Business type updated:", updatedBusinessType.name);

    res.json({
      success: true,
      message: "İşletme türü başarıyla güncellendi",
      data: { businessType: updatedBusinessType },
    });
  } catch (error) {
    console.error("❌ Business type update error:", error);
    res.status(500).json({
      success: false,
      message: "İşletme türü güncellenirken hata oluştu",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   DELETE /api/v1/:appSlug/business-types/:id
// @desc    Delete business type (Admin only)
// @access  Private (SUPER_ADMIN)
router.delete("/:id", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if business type exists
    const businessType = await prisma.businessType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tenantBusinessTypes: true,
            productTemplates: true,
            serviceTemplates: true,
          },
        },
      },
    });

    if (!businessType) {
      return res.status(404).json({
        success: false,
        message: "İşletme türü bulunamadı",
      });
    }

    // Check if business type is being used
    if (businessType._count.tenantBusinessTypes > 0) {
      return res.status(400).json({
        success: false,
        message: "Bu işletme türü kullanımda olduğu için silinemiyor",
        data: {
          tenantsCount: businessType._count.tenantBusinessTypes,
          templatesCount:
            businessType._count.productTemplates +
            businessType._count.serviceTemplates,
        },
      });
    }

    // Soft delete by setting isActive to false
    const deletedBusinessType = await prisma.businessType.update({
      where: { id },
      data: { isActive: false },
    });

    console.log("✅ Business type soft deleted:", deletedBusinessType.name);

    res.json({
      success: true,
      message: "İşletme türü başarıyla silindi",
    });
  } catch (error) {
    console.error("❌ Business type deletion error:", error);
    res.status(500).json({
      success: false,
      message: "İşletme türü silinirken hata oluştu",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/:appSlug/business-types/:id/restore
// @desc    Restore soft deleted business type
// @access  Private (SUPER_ADMIN)
router.post(
  "/:id/restore",
  auth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const businessType = await prisma.businessType.findUnique({
        where: { id },
      });

      if (!businessType) {
        return res.status(404).json({
          success: false,
          message: "İşletme türü bulunamadı",
        });
      }

      const restoredBusinessType = await prisma.businessType.update({
        where: { id },
        data: { isActive: true },
      });

      console.log("✅ Business type restored:", restoredBusinessType.name);

      res.json({
        success: true,
        message: "İşletme türü başarıyla geri yüklendi",
        data: { businessType: restoredBusinessType },
      });
    } catch (error) {
      console.error("❌ Business type restore error:", error);
      res.status(500).json({
        success: false,
        message: "İşletme türü geri yüklenirken hata oluştu",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// @route   POST /api/v1/:appSlug/business-types/reorder
// @desc    Reorder business types
// @access  Private (SUPER_ADMIN)
router.post("/reorder", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { businessTypes } = req.body;

    if (!Array.isArray(businessTypes)) {
      return res.status(400).json({
        success: false,
        message: "İşletme türleri dizisi gereklidir",
      });
    }

    // Update sort order for each business type
    const updatePromises = businessTypes.map((item, index) =>
      prisma.businessType.update({
        where: { id: item.id },
        data: { sortOrder: index },
      })
    );

    await Promise.all(updatePromises);

    console.log("✅ Business types reordered");

    res.json({
      success: true,
      message: "İşletme türleri başarıyla sıralandı",
    });
  } catch (error) {
    console.error("❌ Business type reorder error:", error);
    res.status(500).json({
      success: false,
      message: "İşletme türleri sıralanırken hata oluştu",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   POST /api/v1/:appSlug/business-types/bulk-activate
// @desc    Bulk activate business types
// @access  Private (SUPER_ADMIN)
router.post(
  "/bulk-activate",
  auth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    try {
      const { businessTypeIds } = req.body;

      if (!Array.isArray(businessTypeIds) || businessTypeIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "İşletme türü ID'leri dizisi gereklidir",
        });
      }

      const updatedCount = await prisma.businessType.updateMany({
        where: {
          id: { in: businessTypeIds },
        },
        data: {
          isActive: true,
        },
      });

      console.log(`✅ ${updatedCount.count} business types activated`);

      res.json({
        success: true,
        message: `${updatedCount.count} işletme türü başarıyla aktif edildi`,
        data: { activatedCount: updatedCount.count },
      });
    } catch (error) {
      console.error("❌ Business type bulk activation error:", error);
      res.status(500).json({
        success: false,
        message: "İşletme türleri aktif edilirken hata oluştu",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// @route   POST /api/v1/:appSlug/business-types/bulk-deactivate
// @desc    Bulk deactivate business types
// @access  Private (SUPER_ADMIN)
router.post(
  "/bulk-deactivate",
  auth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    try {
      const { businessTypeIds } = req.body;

      if (!Array.isArray(businessTypeIds) || businessTypeIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "İşletme türü ID'leri dizisi gereklidir",
        });
      }

      // Check if any of the business types are being used by tenants
      const businessTypesInUse = await prisma.businessType.findMany({
        where: {
          id: { in: businessTypeIds },
        },
        include: {
          _count: {
            select: {
              tenantBusinessTypes: true,
            },
          },
        },
      });

      const inUseTypes = businessTypesInUse.filter(
        (type) => type._count.tenantBusinessTypes > 0
      );

      if (inUseTypes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${inUseTypes.length} işletme türü kullanımda olduğu için pasif edilemiyor`,
          data: {
            inUseTypes: inUseTypes.map((type) => ({
              id: type.id,
              name: type.displayName,
              tenantsCount: type._count.tenantBusinessTypes,
            })),
          },
        });
      }

      const updatedCount = await prisma.businessType.updateMany({
        where: {
          id: { in: businessTypeIds },
        },
        data: {
          isActive: false,
        },
      });

      console.log(`✅ ${updatedCount.count} business types deactivated`);

      res.json({
        success: true,
        message: `${updatedCount.count} işletme türü başarıyla pasif edildi`,
        data: { deactivatedCount: updatedCount.count },
      });
    } catch (error) {
      console.error("❌ Business type bulk deactivation error:", error);
      res.status(500).json({
        success: false,
        message: "İşletme türleri pasif edilirken hata oluştu",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

module.exports = router;
