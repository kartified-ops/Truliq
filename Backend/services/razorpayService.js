const {
  getClient,
  getCredentials,
  verifySignature
} = require('./integrations/payment/paymentGatewayService');

const createOrder = async (amount, currency = 'INR', receipt = null, notes = {}) => {
  try {
    const { client, active, keyId, keySecret } = await getClient();
    const creds = active ? { keyId, keySecret, enabled: active.enabled } : { keyId: '', keySecret: '', enabled: false };

    if (!client) {
      console.warn('⚠️ Payment gateway credentials missing. Generating MOCK order for dev mode...');
      const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        success: true,
        orderId: mockOrderId,
        amount: Math.round(amount * 100),
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
        isMock: true
      };
    }

    const options = {
      amount: Math.round(amount * 100),
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes
    };

    const order = await client.orders.create(options);
    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    };
  } catch (error) {
    console.error('❌ Payment create order error:', error.message);
    const creds = await getCredentials();
    if (process.env.NODE_ENV !== 'production' || !creds.keyId || creds.keyId.includes('placeholder')) {
      const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        success: true,
        orderId: mockOrderId,
        amount: Math.round(amount * 100),
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
        isMock: true
      };
    }
    return {
      success: false,
      error: error.error?.description || error.description || error.message || 'Failed to create payment order'
    };
  }
};

const verifyPayment = async (razorpay_order_id, razorpay_payment_id, razorpay_signature) =>
  verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

const getOrderDetails = async (orderId) => {
  try {
    const { client } = await getClient();
    if (!client) return { success: false, error: 'Payment gateway not initialized' };
    const order = await client.orders.fetch(orderId);
    return { success: true, order };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const getPaymentDetails = async (paymentId) => {
  try {
    const { client } = await getClient();
    if (!client) return { success: false, error: 'Payment gateway not initialized' };
    const payment = await client.payments.fetch(paymentId);
    return { success: true, payment };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const refundPayment = async (paymentId, amount = null, notes = {}) => {
  try {
    const { client } = await getClient();
    if (!client) return { success: false, error: 'Payment gateway not initialized' };
    const refundOptions = { payment_id: paymentId, notes };
    if (amount) refundOptions.amount = Math.round(amount * 100);
    const refund = await client.payments.refund(paymentId, refundOptions);
    return { success: true, refund };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const isTestMode = async () => {
  const creds = await getCredentials();
  return creds.keyId ? creds.keyId.startsWith('rzp_test') : true;
};

const getBasicAuthHeader = async () => {
  const creds = await getCredentials();
  return Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
};

const createQRCode = async (amount, bookingNumber, notes = {}) => {
  try {
    const { client, keyId, keySecret } = await getClient();
    if (!client) return { success: false, error: 'Payment gateway not initialized' };

    const axios = require('axios');
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const payload = {
      type: 'upi_qr',
      name: 'Service Payment',
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: Math.round(amount * 100),
      description: `Order Payment for ${bookingNumber}`,
      notes
    };

    try {
      const qrCode = await client.qrCode.create(payload);
      return { success: true, qrCodeId: qrCode.id, imageUrl: qrCode.image_url, qrStatus: qrCode.status };
    } catch (e1) {
      try {
        const response = await axios.post('https://api.razorpay.com/v1/payments/qr_codes', payload, {
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }
        });
        const qrCode = response.data;
        return { success: true, qrCodeId: qrCode.id, imageUrl: qrCode.image_url, qrStatus: qrCode.status };
      } catch (e2) {
        try {
          const response = await axios.post('https://api.razorpay.com/v1/qr_codes', payload, {
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }
          });
          const qrCode = response.data;
          return { success: true, qrCodeId: qrCode.id, imageUrl: qrCode.image_url, qrStatus: qrCode.status };
        } catch (e3) {
          const linkPayload = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            description: `Payment for Booking #${bookingNumber}`,
            notes,
            notify: { sms: false, email: false }
          };
          const linkResponse = await axios.post('https://api.razorpay.com/v1/payment_links', linkPayload, {
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }
          });
          const link = linkResponse.data;
          return {
            success: true,
            qrCodeId: link.id,
            imageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link.short_url)}`,
            paymentUrl: link.short_url
          };
        }
      }
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error?.description || error.message;
    return { success: false, error: errorMsg };
  }
};

const getQRCodePayments = async (id) => {
  try {
    const { client, keyId, keySecret } = await getClient();
    if (!client) return { success: false, error: 'Payment gateway not initialized' };

    if (id && id.startsWith('plink_')) {
      const axios = require('axios');
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await axios.get(`https://api.razorpay.com/v1/payment_links/${id}`, {
        headers: { Authorization: `Basic ${auth}` }
      });
      const link = response.data;
      if (link.status === 'paid' || link.status === 'partially_paid') {
        return {
          success: true,
          payments: [{
            id: link.razorpay_payment_id || `pay_${Date.now()}`,
            status: 'captured',
            amount: link.amount_paid
          }]
        };
      }
      return { success: true, payments: [] };
    }

    const payments = await client.qrCode.fetchAllPayments(id);
    return { success: true, payments: payments.items || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getOrderDetails,
  getPaymentDetails,
  refundPayment,
  createQRCode,
  getQRCodePayments,
  getCredentials,
  isTestMode
};
