import React from 'react';
import SimpleProviderCards from './SimpleProviderCards';

const PaymentGatewaySettings = () => (
  <SimpleProviderCards
    serviceName="payment_gateway"
    title="Payment Gateway Settings"
    description="Manage payment gateway credentials. The active provider handles all payment operations."
  />
);

export default PaymentGatewaySettings;
