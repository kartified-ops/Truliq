import React from 'react';
import SimpleProviderCards from './SimpleProviderCards';

const MailSettings = () => (
  <SimpleProviderCards
    serviceName="email"
    title="Mail Configuration"
    description="Configure email provider credentials for transactional emails."
  />
);

export default MailSettings;
