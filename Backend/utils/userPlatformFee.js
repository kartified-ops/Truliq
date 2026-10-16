/**
 * Customer platform fee — configured in Admin → Settings → Financial → "User Platform Fee".
 *
 * Fee   = fixed ₹ amount, or a % of the billable base (services + parts, before GST).
 * Fee GST = optional % charged on top of the fee.
 * Nothing is hardcoded: a rate / amount of 0 means "not charged", and callers hide the line.
 */
const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2));

/**
 * @param {object} settings  Settings document (or lean object); may be null
 * @param {number} base      Billable base (services + parts, excl. GST)
 * @returns {{ fee:number, gst:number, total:number, type:string, rate:number, gstRate:number }}
 */
const computeUserPlatformFee = (settings, base) => {
  const type = settings?.userPlatformFeeType === 'fixed' ? 'fixed' : 'percentage';
  const rate = type === 'fixed'
    ? Math.max(0, Number(settings?.userPlatformFeeFixed) || 0)
    : Math.min(100, Math.max(0, Number(settings?.userPlatformFeePercentage) || 0));
  const gstRate = Math.min(100, Math.max(0, Number(settings?.userPlatformFeeGstPercentage) || 0));

  const billable = Number(base) || 0;
  // No fee on a free (₹0) booking, regardless of the configured amount.
  const fee = billable > 0 ? (type === 'fixed' ? round2(rate) : round2((billable * rate) / 100)) : 0;
  const gst = fee > 0 ? round2((fee * gstRate) / 100) : 0;

  return { fee, gst, total: round2(fee + gst), type, rate, gstRate };
};

/** What a direct worker keeps from a bill: everything except the customer platform fee (+GST), which the company owns. */
const workerKeepsFromBill = (bill) => round2((Number(bill?.grandTotal) || 0) - (Number(bill?.userPlatformFeeTotal) || 0));

module.exports = { computeUserPlatformFee, workerKeepsFromBill };
