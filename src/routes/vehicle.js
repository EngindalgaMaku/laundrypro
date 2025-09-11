const express = require("express");
const { prisma } = require("../config/database");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/vehicles
// @desc    Get all vehicles
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId, isActive: true },
      include: {
        _count: {
          select: {
            orders: {
              where: {
                status: {
                  in: ["PICKED_UP", "WASHING", "READY"],
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: { vehicles },
    });
  } catch (error) {
    console.error("Get vehicles error:", error);
    res.status(500).json({
      success: false,
      message: "Araçlar getirme hatası",
    });
  }
});

// @route   POST /api/v1/vehicles
// @desc    Create new vehicle
// @access  Private (Admin/Manager)
router.post("/", auth, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, plate, type = "VAN", capacity } = req.body;

    if (!name || !plate) {
      return res.status(400).json({
        success: false,
        message: "Araç adı ve plakası gerekli",
      });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        tenantId,
        name,
        plate: plate.toUpperCase(),
        type,
        capacity: capacity || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "Araç başarıyla oluşturuldu",
      data: { vehicle },
    });
  } catch (error) {
    console.error("Create vehicle error:", error);
    res.status(500).json({
      success: false,
      message: "Araç oluşturma hatası",
    });
  }
});

module.exports = router;
