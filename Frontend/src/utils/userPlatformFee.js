// Customer platform fee — mirrors Backend/utils/userPlatformFee.js.
// Rates come from Admin → Settings → User Platform Fee; nothing is hardcoded. 0 = not charged / not shown.
const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2));

export const computeUserPlatformFee = (settings, base) => {
  const type = settings?.userPlatformFeeType === 'fixed' ? 'fixed' : 'percentage';
  const rate = type === 'fixed'
    ? Math.max(0, Number(settings?.userPlatformFeeFixed) || 0)
    : Math.min(100, Math.max(0, Number(settings?.userPlatformFeePercentage) || 0));
  const gstRate = Math.min(100, Math.max(0, Number(settings?.userPlatformFeeGstPercentage) || 0));

  const billable = Number(base) || 0;
  const fee = billable > 0 ? (type === 'fixed' ? round2(rate) : round2((billable * rate) / 100)) : 0;
  const gst = fee > 0 ? round2((fee * gstRate) / 100) : 0;

  return { fee, gst, total: round2(fee + gst), type, rate, gstRate };
};

// Label for the fee line, e.g. "Platform Fee (5%)" or "Platform Fee" for a fixed amount.
export const platformFeeLabel = ({ type, rate }) =>
  type === 'percentage' && rate > 0 ? `Platform Fee (${rate}%)` : 'Platform Fee';
