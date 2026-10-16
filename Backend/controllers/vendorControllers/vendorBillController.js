const VendorBill = require('../../models/VendorBill');
const Booking = require('../../models/Booking');
const VendorServiceCatalog = require('../../models/VendorServiceCatalog');
const UserService = require('../../models/UserService');
const VendorPartsCatalog = require('../../models/VendorPartsCatalog');
const Settings = require('../../models/Settings');
const { BILL_STATUS } = require('../../utils/constants');
const { DEFAULT_SERVICE_PAYOUT_PCT } = require('../../utils/commission');
const { computeUserPlatformFee } = require('../../utils/userPlatformFee');

/**
 * Create or Update Vendor Bill
 * ────────────────────────────
 * Revenue Model:
 *   Vendor → 70% of total service BASE (excl GST)
 *   Vendor → 10% of total parts BASE  (excl GST)
 *   GST   → 100% retained by company
 *
 * VendorBill is the SINGLE source of truth for earnings.
 * Booking does NOT store vendorEarnings/adminCommission.
 *
 * POST /api/vendors/bookings/:bookingId/bill
 */
const createOrUpdateBill = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { services, parts, customItems, transportCharges, applyPartsGST = true } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const { USER_ROLES } = require('../../utils/constants');

    // Auth check: Vendor or assigned Worker
    const isVendorAuth = booking.vendorId && booking.vendorId.toString() === req.user.id && req.userRole === USER_ROLES.VENDOR;
    const isWorkerAuth = booking.workerId && booking.workerId.toString() === req.user.id && req.userRole === USER_ROLES.WORKER;

    if (!isVendorAuth && !isWorkerAuth) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    // Always use the booking's vendorId for the bill
    const billVendorId = booking.vendorId;

    // ── Fetch Settings (frozen snapshot) ──
    const settings = await Settings.findOne({ type: 'global' });

    // Check if it's a Direct Worker flow to apply 100% payout
    const isDirectWorkerFlow = booking.bookingModel === 'worker';

    const { getWorkerServiceSplitPct } = require('../../services/promotionalOfferService');
    // Direct worker: admin-configured job platform fee (percentage or fixed ₹), waived during a free-fee promo
    const { isFreePlatformFeeActive } = require('../../services/promotionalOfferService');
    const workerFeeWaived = isDirectWorkerFlow && booking.workerId
      ? await isFreePlatformFeeActive(booking.workerId)
      : false;
    const workerFeeIsFixed = isDirectWorkerFlow && !workerFeeWaived && settings?.workerJobFeeType === 'fixed';
    const workerFeePct = isDirectWorkerFlow && !workerFeeWaived && !workerFeeIsFixed
      ? Math.min(100, Math.max(0, Number(settings?.workerJobFeePercentage) || 0))
      : 0;
    const workerFixedFee = workerFeeIsFixed ? Math.max(0, Number(settings?.workerJobFeeFixed) || 0) : 0;

    const existingServiceSplit = isDirectWorkerFlow ? 100 - workerFeePct : (settings?.servicePayoutPercentage ?? DEFAULT_SERVICE_PAYOUT_PCT);
    const existingPartsSplit = isDirectWorkerFlow ? 100 - workerFeePct : (settings?.partsPayoutPercentage ?? 10);
    const serviceSplitPct = isDirectWorkerFlow
      ? await getWorkerServiceSplitPct({
        workerId: booking.workerId,
        existingSplitPct: existingServiceSplit
      })
      : existingServiceSplit;
    const partsSplitPct = isDirectWorkerFlow ? (serviceSplitPct === 100 ? 100 : existingPartsSplit) : existingPartsSplit;
    // GST rates come from the admin panel (Settings → Financial). Same source the user checkout,
    // worker billing screen and vendor completion flow read, so every screen agrees.
    const serviceGstPct = Math.max(0, Number(settings?.serviceGstPercentage) || 0);
    const partsGstPct = Math.max(0, Number(settings?.partsGstPercentage) || 0);

    // ═══════════════════════════════════════
    // 1. ORIGINAL SERVICE (from booking)
    // ═══════════════════════════════════════
    const isPlanBooking = booking.paymentMethod === 'plan_benefit';
    const originalServiceBaseForBill = isPlanBooking ? 0 : (booking.basePrice || 0);
    const originalServiceBaseForEarnings = booking.basePrice || 0;
    const originalGST = isPlanBooking ? 0 : parseFloat(((originalServiceBaseForBill * serviceGstPct) / 100).toFixed(2));
    const visitingCharges = 0;

    // ═══════════════════════════════════════
    // 2. VENDOR-ADDED SERVICES
    // ═══════════════════════════════════════
    const processedServices = [];
    let vendorServiceBase = 0;
    let vendorServiceGST = 0;

    if (services && Array.isArray(services)) {
      for (const item of services) {
        let catalogItem = null;
        if (item.catalogId) {
          catalogItem = await VendorServiceCatalog.findById(item.catalogId);
          if (!catalogItem) {
            // Admin-managed service picked from the worker catalog
            const adminService = await UserService.findById(item.catalogId).select('title basePrice').lean();
            if (adminService) catalogItem = { name: adminService.title, price: adminService.basePrice };
          }
        }

        const name = catalogItem ? catalogItem.name : item.name;
        // Catalog prices are BASE PRICES (excl GST)
        const unitBasePrice = catalogItem ? catalogItem.price : (Number(item.price) || 0);
        const quantity = Number(item.quantity) || 1;

        const base = unitBasePrice * quantity;
        const gst = parseFloat(((base * serviceGstPct) / 100).toFixed(2));
        const totalInclusive = parseFloat((base + gst).toFixed(2));

        processedServices.push({
          catalogId: item.catalogId,
          name,
          price: unitBasePrice,
          gstPercentage: serviceGstPct,
          quantity,
          gstAmount: gst,
          total: totalInclusive,
          isOriginal: false
        });

        vendorServiceBase += base;
        vendorServiceGST += gst;
      }
    }

    // ═══════════════════════════════════════
    // 3. PARTS
    // ═══════════════════════════════════════
    const processedParts = [];
    let totalPartsBase = 0;
    let partsGST = 0;

    if (parts && Array.isArray(parts)) {
      for (const item of parts) {
        let catalogItem = null;
        if (item.catalogId) {
          catalogItem = await VendorPartsCatalog.findById(item.catalogId);
        }

        const name = catalogItem ? catalogItem.name : item.name;
        const unitBasePrice = catalogItem ? catalogItem.price : (Number(item.price) || 0);
        const quantity = Number(item.quantity) || 1;
        const pGstPct = catalogItem ? (catalogItem.gstPercentage || partsGstPct) : (Number(item.gstPercentage) || partsGstPct);

        const base = unitBasePrice * quantity;
        // Honour the worker's GST toggle — if applyPartsGST=false, force zero GST
        const effectivePGstPct = applyPartsGST ? pGstPct : 0;
        const gst = applyPartsGST ? parseFloat(((base * pGstPct) / 100).toFixed(2)) : 0;

        processedParts.push({
          catalogId: item.catalogId,
          name,
          price: unitBasePrice,
          gstPercentage: effectivePGstPct,
          quantity,
          gstAmount: gst,
          total: parseFloat((base + gst).toFixed(2))
        });

        totalPartsBase += base;
        partsGST += gst;
      }
    }

    // ═══════════════════════════════════════
    // 3.5 CUSTOM ITEMS (treated as Parts for revenue logic)
    // ═══════════════════════════════════════
    const processedCustomItems = []; // To store in bill

    if (customItems && Array.isArray(customItems)) {
      for (const item of customItems) {
        const name = item.name || 'Custom Item';
        const unitBasePrice = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        // Default custom items to parts GST % if not provided (usually from settings)
        const cGstPct = Number(item.gstPercentage) || partsGstPct;

        const base = unitBasePrice * quantity;
        // Honour the worker's GST toggle — if applyPartsGST=false, force zero GST on custom items too
        const itemGstApplicable = item.gstApplicable !== undefined ? item.gstApplicable : true;
        const finalGstApplicable = applyPartsGST && itemGstApplicable;

        const effectiveCGstPct = finalGstApplicable ? cGstPct : 0;
        const gst = finalGstApplicable ? parseFloat(((base * cGstPct) / 100).toFixed(2)) : 0;

        processedCustomItems.push({
          name,
          price: unitBasePrice,
          gstPercentage: effectiveCGstPct,
          quantity,
          gstAmount: gst,
          total: parseFloat((base + gst).toFixed(2)),
          hsnCode: item.hsnCode || '',
          gstApplicable: finalGstApplicable
        });

        // Add to PARTS totals
        totalPartsBase += base;
        partsGST += gst;
      }
    }

    // ═══════════════════════════════════════
    // 4. AGGREGATION
    // ═══════════════════════════════════════
    const totalServiceBaseForBill = parseFloat((originalServiceBaseForBill + vendorServiceBase).toFixed(2));
    const totalServiceBaseForEarnings = parseFloat((originalServiceBaseForEarnings + vendorServiceBase).toFixed(2));
    totalPartsBase = parseFloat(totalPartsBase.toFixed(2));

    const totalGST = parseFloat((originalGST + vendorServiceGST + partsGST).toFixed(2));
    const finalTransportCharges = Number(transportCharges) || 0;
    // Customer platform fee (admin Settings → User Platform Fee), on service + parts base. 0 = none.
    const userFee = computeUserPlatformFee(settings, totalServiceBaseForBill + totalPartsBase);
    const grandTotal = parseFloat((totalServiceBaseForBill + totalPartsBase + totalGST + visitingCharges + finalTransportCharges + userFee.total).toFixed(2));

    // ═══════════════════════════════════════
    // 5. REVENUE SPLIT (% applied on BASE only)
    // ═══════════════════════════════════════
    let vendorServiceEarning = parseFloat(((totalServiceBaseForEarnings * serviceSplitPct) / 100).toFixed(2));
    let vendorPartsEarning = parseFloat(((totalPartsBase * partsSplitPct) / 100).toFixed(2));
    if (workerFixedFee > 0) {
      // Fixed ₹ platform fee per job: take from service earning first, then parts
      const fromService = Math.min(workerFixedFee, vendorServiceEarning);
      vendorServiceEarning = parseFloat((vendorServiceEarning - fromService).toFixed(2));
      vendorPartsEarning = parseFloat(Math.max(0, vendorPartsEarning - (workerFixedFee - fromService)).toFixed(2));
    }
    const vendorTotalEarning = parseFloat((vendorServiceEarning + vendorPartsEarning).toFixed(2));
    const companyRevenue = parseFloat((grandTotal - vendorTotalEarning).toFixed(2));

    // ═══════════════════════════════════════
    // 6. ALL SERVICES (original + vendor-added)
    // ═══════════════════════════════════════
    const allServices = [
      {
        name: booking.serviceName || 'Original Service',
        price: originalServiceBaseForBill,
        gstPercentage: serviceGstPct,
        quantity: 1,
        gstAmount: originalGST,
        total: parseFloat((originalServiceBaseForBill + originalGST).toFixed(2)),
        isOriginal: true
      },
      ...processedServices
    ];

    // ═══════════════════════════════════════
    // 7. SAVE BILL
    // ═══════════════════════════════════════
    let bill = await VendorBill.findOne({ bookingId });

    const billData = {
      vendorId: billVendorId,
      workerId: booking.workerId,
      services: allServices,
      parts: processedParts,
      customItems: processedCustomItems,
      originalServiceBase: originalServiceBaseForBill,
      vendorServiceBase: parseFloat(vendorServiceBase.toFixed(2)),
      totalServiceBase: totalServiceBaseForBill,
      totalPartsBase,
      originalGST,
      vendorServiceGST: parseFloat(vendorServiceGST.toFixed(2)),
      partsGST: parseFloat(partsGST.toFixed(2)),
      totalGST,
      visitingCharges,
      transportCharges: finalTransportCharges,
      userPlatformFee: userFee.fee,
      userPlatformFeeGst: userFee.gst,
      userPlatformFeeTotal: userFee.total,
      userPlatformFeeConfig: { type: userFee.type, rate: userFee.rate, gstRate: userFee.gstRate },
      grandTotal,
      payoutConfig: {
        serviceSplitPercentage: serviceSplitPct,
        partsSplitPercentage: partsSplitPct,
        serviceGstPercentage: serviceGstPct,
        partsGstPercentage: partsGstPct
      },
      vendorServiceEarning,
      vendorPartsEarning,
      vendorTotalEarning,
      companyRevenue,
      applyPartsGST,
      status: BILL_STATUS.GENERATED,
      generatedAt: new Date()
    };

    if (bill) {
      Object.assign(bill, billData);
      await bill.save();
    } else {
      bill = await VendorBill.create({ bookingId, ...billData });
    }

    // ═══════════════════════════════════════
    // 8. UPDATE BOOKING (no earnings!)
    // ═══════════════════════════════════════
    booking.finalAmount = grandTotal;
    booking.userPayableAmount = grandTotal;
    booking.vendorBillId = bill._id;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Bill generated successfully',
      bill,
      financials: {
        grandTotal,
        vendorTotalEarning,
        companyRevenue,
        breakdown: {
          serviceBase: totalServiceBaseForBill,
          partsBase: totalPartsBase,
          totalGST
        }
      }
    });

  } catch (error) {
    console.error('Create/Update Bill error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.name
    });
  }
};

/**
 * Get Bill by Booking ID
 * GET /api/vendors/bookings/:bookingId/bill
 */
const getBillByBookingId = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const { USER_ROLES } = require('../../utils/constants');

    const isVendorAuth = booking.vendorId && booking.vendorId.toString() === req.user.id && req.userRole === USER_ROLES.VENDOR;
    const isWorkerAuth = booking.workerId && booking.workerId.toString() === req.user.id && req.userRole === USER_ROLES.WORKER;

    if (!isVendorAuth && !isWorkerAuth) {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
    }

    const bill = await VendorBill.findOne({ bookingId }).populate('services.catalogId parts.catalogId');

    if (!bill) {
      // Return 200 instead of 404 to gracefully tell the frontend that a bill is not yet created
      // This prevents Ugly `404 (Not Found)` network errors in the console from Axios on page load
      return res.status(200).json({ success: true, bill: null, message: 'Bill not found' });
    }

    res.status(200).json({ success: true, bill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bill' });
  }
};

module.exports = {
  createOrUpdateBill,
  getBillByBookingId
};
