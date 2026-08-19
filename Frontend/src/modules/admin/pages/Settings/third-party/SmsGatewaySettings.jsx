import React from 'react';
import SimpleProviderCards from './SimpleProviderCards';

const SmsGatewaySettings = () => (
  <SimpleProviderCards
    serviceName="sms"
    title="SMS Gateway Settings"
    description="Configure SMS provider credentials. The active provider handles all OTP and notification messages."
  />
);

export default SmsGatewaySettings;
