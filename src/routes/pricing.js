const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { auth, requireRole } = require("../middleware/auth");
const router = express.Router();
const prisma = new PrismaClient();

// POST - Calculate pricing for products/services
router.post("/calculate", auth, async (req, res) => {
  try {
    const {
      businessTypeId,
      items, // [{ type: 'product|service', templateId: 'uuid', quantity: 1, customAttributes: {} }]
      customerId,
      orderDate,
      discountCodes = [],
    } = req.body;

    // Validation
    if (
      !businessTypeId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "businessTypeId ve items array'i gereklidir",
      });
    }

    // Get business type
    const businessType = await prisma.businessType.findUnique({
      where: { id: businessTypeId },
      include: {
        pricingRules: {
          where: { isActive: true },
          orderBy: { priority: "asc" },
        },
      },
    });

    if (!businessType) {
      return res.status(404).json({
        success: false,
        message: "Business type bulunamadı",
      });
    }

    let totalCalculation = {
      subtotal: 0,
      discounts: [],
      surcharges: [],
      total: 0,
      items: [],
    };

    // Process each item
    for (const item of items) {
      let itemCalculation = await calculateItemPrice(
        item,
        businessType,
        customerId,
        orderDate
      );
      totalCalculation.items.push(itemCalculation);
      totalCalculation.subtotal += itemCalculation.total;
    }

    // Apply business-level pricing rules
    totalCalculation = await applyBusinessPricingRules(
      totalCalculation,
      businessType.pricingRules,
      {
        customerId,
        orderDate,
        totalQuantity: items.reduce(
          (sum, item) => sum + (item.quantity || 1),
          0
        ),
      }
    );

    // Apply discount codes
    if (discountCodes.length > 0) {
      totalCalculation = await applyDiscountCodes(
        totalCalculation,
        discountCodes,
        customerId
      );
    }

    // Final total calculation
    totalCalculation.total = Math.max(
      0,
      totalCalculation.subtotal -
        totalCalculation.discounts.reduce((sum, d) => sum + d.amount, 0) +
        totalCalculation.surcharges.reduce((sum, s) => sum + s.amount, 0)
    );

    res.status(200).json({
      success: true,
      data: {
        calculation: totalCalculation,
        businessType: {
          id: businessType.id,
          name: businessType.name,
          displayName: businessType.displayName,
        },
        calculatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      },
    });
  } catch (error) {
    console.error("Pricing calculation error:", error);
    res.status(500).json({
      success: false,
      message: "Fiyat hesaplaması yapılamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Helper function to calculate individual item price
async function calculateItemPrice(item, businessType, customerId, orderDate) {
  const { type, templateId, quantity = 1, customAttributes = {} } = item;

  let template = null;
  let basePrice = 0;
  let itemInfo = {};

  // Get template based on type
  if (type === "product") {
    template = await prisma.productTemplate.findUnique({
      where: { id: templateId },
      include: { businessType: true },
    });
    if (template) {
      basePrice = template.basePrice;
      itemInfo = {
        id: template.id,
        name: template.name,
        description: template.description,
        unit: template.unit,
        category: template.category,
      };
    }
  } else if (type === "service") {
    template = await prisma.serviceTemplate.findUnique({
      where: { id: templateId },
      include: { businessType: true },
    });
    if (template) {
      basePrice = template.basePrice;
      itemInfo = {
        id: template.id,
        name: template.name,
        description: template.description,
        duration: template.duration,
        category: template.category,
      };
    }
  }

  if (!template) {
    throw new Error(`Template bulunamadı: ${templateId}`);
  }

  // Base calculation
  let itemTotal = basePrice * quantity;
  let appliedRules = [];

  // Apply template-specific attributes
  if (template.attributes && Object.keys(template.attributes).length > 0) {
    const attributeModifiers = calculateAttributeModifiers(
      template.attributes,
      customAttributes
    );
    itemTotal += attributeModifiers.additionalCost;
    if (attributeModifiers.rules.length > 0) {
      appliedRules.push(...attributeModifiers.rules);
    }
  }

  return {
    type,
    template: itemInfo,
    quantity,
    basePrice,
    customAttributes,
    subtotal: basePrice * quantity,
    total: itemTotal,
    appliedRules,
  };
}

// Helper function to apply business-level pricing rules
async function applyBusinessPricingRules(calculation, pricingRules, context) {
  const { customerId, orderDate, totalQuantity } = context;

  for (const rule of pricingRules) {
    try {
      const conditions = rule.conditions || {};
      const ruleCalc = rule.calculation || {};

      // Check if rule conditions are met
      if (shouldApplyRule(rule, calculation, context)) {
        const adjustment = calculateRuleAdjustment(rule, calculation, context);

        if (adjustment.amount !== 0) {
          if (adjustment.amount > 0) {
            // Surcharge
            calculation.surcharges.push({
              ruleId: rule.id,
              name: rule.name,
              type: rule.ruleType,
              amount: adjustment.amount,
              description: adjustment.description,
            });
          } else {
            // Discount
            calculation.discounts.push({
              ruleId: rule.id,
              name: rule.name,
              type: rule.ruleType,
              amount: Math.abs(adjustment.amount),
              description: adjustment.description,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error applying pricing rule ${rule.id}:`, error);
      // Continue with other rules
    }
  }

  return calculation;
}

// Helper function to check if pricing rule should be applied
function shouldApplyRule(rule, calculation, context) {
  const conditions = rule.conditions || {};
  const { totalQuantity } = context;

  // Check quantity-based conditions
  if (conditions.minQuantity && totalQuantity < conditions.minQuantity) {
    return false;
  }
  if (conditions.maxQuantity && totalQuantity > conditions.maxQuantity) {
    return false;
  }

  // Check amount-based conditions
  if (conditions.minAmount && calculation.subtotal < conditions.minAmount) {
    return false;
  }
  if (conditions.maxAmount && calculation.subtotal > conditions.maxAmount) {
    return false;
  }

  // Check date-based conditions
  if (conditions.validFrom) {
    const validFrom = new Date(conditions.validFrom);
    const orderDate = new Date(context.orderDate || Date.now());
    if (orderDate < validFrom) {
      return false;
    }
  }
  if (conditions.validTo) {
    const validTo = new Date(conditions.validTo);
    const orderDate = new Date(context.orderDate || Date.now());
    if (orderDate > validTo) {
      return false;
    }
  }

  // Check day of week conditions
  if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
    const orderDate = new Date(context.orderDate || Date.now());
    const dayOfWeek = orderDate.getDay(); // 0 = Sunday, 6 = Saturday
    if (!conditions.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
  }

  return true;
}

// Helper function to calculate rule adjustment amount
function calculateRuleAdjustment(rule, calculation, context) {
  const ruleCalc = rule.calculation || {};
  let amount = 0;
  let description = rule.description || rule.name;

  switch (rule.ruleType) {
    case "PERCENTAGE_DISCOUNT":
      amount = -((calculation.subtotal * (ruleCalc.percentage || 0)) / 100);
      description = `%${ruleCalc.percentage} indirim`;
      break;

    case "FIXED_DISCOUNT":
      amount = -(ruleCalc.amount || 0);
      description = `₺${ruleCalc.amount} indirim`;
      break;

    case "QUANTITY_DISCOUNT":
      if (context.totalQuantity >= (ruleCalc.minQuantity || 1)) {
        const discountPerItem = ruleCalc.discountPerItem || 0;
        amount = -(context.totalQuantity * discountPerItem);
        description = `${context.totalQuantity} adet için birim indirim`;
      }
      break;

    case "BULK_PRICING":
      if (context.totalQuantity >= (ruleCalc.minQuantity || 1)) {
        const newUnitPrice = ruleCalc.newUnitPrice || 0;
        const originalTotal = calculation.subtotal;
        const bulkTotal = context.totalQuantity * newUnitPrice;
        amount = bulkTotal - originalTotal;
        description = `Toplu fiyat (${context.totalQuantity} adet)`;
      }
      break;

    case "EXPRESS_SURCHARGE":
      if (ruleCalc.expressMultiplier) {
        amount = calculation.subtotal * (ruleCalc.expressMultiplier - 1);
        description = `Express hizmet (%${(
          (ruleCalc.expressMultiplier - 1) *
          100
        ).toFixed(0)} ek)`;
      } else if (ruleCalc.expressAmount) {
        amount = ruleCalc.expressAmount;
        description = `Express hizmet (₺${ruleCalc.expressAmount} ek)`;
      }
      break;

    case "LOYAL_CUSTOMER_DISCOUNT":
      // This would require customer history check
      if (ruleCalc.discountPercentage) {
        amount = -(
          (calculation.subtotal * (ruleCalc.discountPercentage || 0)) /
          100
        );
        description = `Sadık müşteri indirimi (%${ruleCalc.discountPercentage})`;
      }
      break;

    case "SEASONAL_ADJUSTMENT":
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const seasonalRules = ruleCalc.seasonal || {};

      for (const [season, adjustment] of Object.entries(seasonalRules)) {
        const seasonMonths = getSeasonMonths(season);
        if (seasonMonths.includes(month)) {
          if (adjustment.type === "percentage") {
            amount = (calculation.subtotal * (adjustment.value || 0)) / 100;
          } else {
            amount = adjustment.value || 0;
          }
          description = `${season} fiyat ayarlaması`;
          break;
        }
      }
      break;

    default:
      console.warn(`Unsupported pricing rule type: ${rule.ruleType}`);
  }

  return {
    amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
    description,
  };
}

// Helper function to calculate attribute modifiers
function calculateAttributeModifiers(templateAttributes, customAttributes) {
  let additionalCost = 0;
  let rules = [];

  for (const [key, value] of Object.entries(customAttributes)) {
    const attrConfig = templateAttributes[key];
    if (attrConfig && attrConfig.pricingModifier) {
      const modifier = attrConfig.pricingModifier;

      if (modifier.type === "fixed") {
        additionalCost += modifier.amount || 0;
        rules.push(`${key}: +₺${modifier.amount}`);
      } else if (modifier.type === "multiplier") {
        // This would be applied to base price, handled in main calculation
        rules.push(`${key}: ${modifier.multiplier}x çarpan`);
      }
    }
  }

  return { additionalCost, rules };
}

// Helper function to apply discount codes
async function applyDiscountCodes(calculation, discountCodes, customerId) {
  // This would integrate with a discount codes system
  // For now, just return the calculation unchanged
  console.log("Discount codes not implemented yet:", discountCodes);
  return calculation;
}

// Helper function to get months for seasons
function getSeasonMonths(season) {
  const seasons = {
    winter: [12, 1, 2],
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11],
    fall: [9, 10, 11],
  };
  return seasons[season.toLowerCase()] || [];
}

// GET - Get pricing rules for a business type
router.get("/rules/:businessTypeId", auth, async (req, res) => {
  try {
    const { businessTypeId } = req.params;
    const { isActive } = req.query;

    const filters = { businessTypeId };
    if (isActive !== undefined) {
      filters.isActive = isActive === "true";
    }

    const pricingRules = await prisma.pricingRule.findMany({
      where: filters,
      include: {
        businessType: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: { priority: "asc" },
    });

    res.status(200).json({
      success: true,
      data: {
        pricingRules: pricingRules.map((rule) => ({
          id: rule.id,
          businessTypeId: rule.businessTypeId,
          name: rule.name,
          description: rule.description,
          ruleType: rule.ruleType,
          conditions: rule.conditions,
          calculation: rule.calculation,
          isActive: rule.isActive,
          priority: rule.priority,
          businessType: rule.businessType,
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        })),
      },
      meta: {
        total: pricingRules.length,
        businessTypeId,
      },
    });
  } catch (error) {
    console.error("Pricing rules fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Pricing rules alınamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST - Create new pricing rule (SUPER_ADMIN only)
router.post("/rules", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const {
      businessTypeId,
      name,
      description,
      ruleType,
      conditions = {},
      calculation = {},
      isActive = true,
      priority = 0,
    } = req.body;

    // Validation
    if (!businessTypeId || !name || !ruleType) {
      return res.status(400).json({
        success: false,
        message: "businessTypeId, name ve ruleType gereklidir",
      });
    }

    // Validate rule type
    const validRuleTypes = [
      "PERCENTAGE_DISCOUNT",
      "FIXED_DISCOUNT",
      "QUANTITY_DISCOUNT",
      "BULK_PRICING",
      "EXPRESS_SURCHARGE",
      "LOYAL_CUSTOMER_DISCOUNT",
      "SEASONAL_ADJUSTMENT",
    ];

    if (!validRuleTypes.includes(ruleType)) {
      return res.status(400).json({
        success: false,
        message: `Geçersiz rule type. Geçerli tipler: ${validRuleTypes.join(
          ", "
        )}`,
      });
    }

    // Check business type exists
    const businessType = await prisma.businessType.findUnique({
      where: { id: businessTypeId },
    });

    if (!businessType) {
      return res.status(404).json({
        success: false,
        message: "Business type bulunamadı",
      });
    }

    // Create pricing rule
    const pricingRule = await prisma.pricingRule.create({
      data: {
        businessTypeId,
        name: name.trim(),
        description: description?.trim() || "",
        ruleType,
        conditions,
        calculation,
        isActive,
        priority: parseInt(priority) || 0,
      },
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

    res.status(201).json({
      success: true,
      message: "Pricing rule başarıyla oluşturuldu",
      data: {
        pricingRule: {
          id: pricingRule.id,
          businessTypeId: pricingRule.businessTypeId,
          name: pricingRule.name,
          description: pricingRule.description,
          ruleType: pricingRule.ruleType,
          conditions: pricingRule.conditions,
          calculation: pricingRule.calculation,
          isActive: pricingRule.isActive,
          priority: pricingRule.priority,
          businessType: pricingRule.businessType,
          createdAt: pricingRule.createdAt,
          updatedAt: pricingRule.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Pricing rule creation error:", error);
    res.status(500).json({
      success: false,
      message: "Pricing rule oluşturulamadı",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// PUT - Update pricing rule (SUPER_ADMIN only)
router.put("/rules/:id", auth, requireRole("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      ruleType,
      conditions,
      calculation,
      isActive,
      priority,
    } = req.body;

    // Check if rule exists
    const existingRule = await prisma.pricingRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule bulunamadı",
      });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (ruleType !== undefined) updateData.ruleType = ruleType;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (calculation !== undefined) updateData.calculation = calculation;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (priority !== undefined) updateData.priority = parseInt(priority);

    // Update pricing rule
    const pricingRule = await prisma.pricingRule.update({
      where: { id },
      data: updateData,
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
      message: "Pricing rule başarıyla güncellendi",
      data: {
        pricingRule: {
          id: pricingRule.id,
          businessTypeId: pricingRule.businessTypeId,
          name: pricingRule.name,
          description: pricingRule.description,
          ruleType: pricingRule.ruleType,
          conditions: pricingRule.conditions,
          calculation: pricingRule.calculation,
          isActive: pricingRule.isActive,
          priority: pricingRule.priority,
          businessType: pricingRule.businessType,
          createdAt: pricingRule.createdAt,
          updatedAt: pricingRule.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Pricing rule update error:", error);
    res.status(500).json({
      success: false,
      message: "Pricing rule güncellenemedi",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// DELETE - Delete pricing rule (SUPER_ADMIN only)
router.delete(
  "/rules/:id",
  auth,
  requireRole("SUPER_ADMIN"),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if rule exists
      const existingRule = await prisma.pricingRule.findUnique({
        where: { id },
      });

      if (!existingRule) {
        return res.status(404).json({
          success: false,
          message: "Pricing rule bulunamadı",
        });
      }

      // Delete pricing rule
      await prisma.pricingRule.delete({
        where: { id },
      });

      res.status(200).json({
        success: true,
        message: "Pricing rule başarıyla silindi",
      });
    } catch (error) {
      console.error("Pricing rule delete error:", error);
      res.status(500).json({
        success: false,
        message: "Pricing rule silinemedi",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

module.exports = router;
