import React from 'react';
import SimpleProviderCards from './SimpleProviderCards';

const StorageSettings = () => (
  <SimpleProviderCards
    serviceName="storage"
    title="Media Storage"
    description="Configure cloud storage credentials for image and file uploads."
  />
);

export default StorageSettings;
