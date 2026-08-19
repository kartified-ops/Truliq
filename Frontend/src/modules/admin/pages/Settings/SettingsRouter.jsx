import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminSettings from './index';
import ThirdPartyLayout from './third-party/ThirdPartyLayout';
import PaymentGatewaySettings from './third-party/PaymentGatewaySettings';
import SmsGatewaySettings from './third-party/SmsGatewaySettings';
import FirebaseSettings from './third-party/FirebaseSettings';
import MapsSettings from './third-party/MapsSettings';
import MailSettings from './third-party/MailSettings';
import StorageSettings from './third-party/StorageSettings';
import NotificationChannelSettings from './third-party/NotificationChannelSettings';
import ComingSoonSettings from './third-party/ComingSoonSettings';
import SimpleProviderCards from './third-party/SimpleProviderCards';

const SettingsRouter = () => (
  <Routes>
    <Route path="third-%20party/*" element={<Navigate to="/admin/settings/third-party/payment-gateway" replace />} />
    <Route path="third-party/*" element={<ThirdPartyLayout />}>
      <Route index element={<Navigate to="payment-gateway" replace />} />
      <Route path="payment-gateway" element={<PaymentGatewaySettings />} />
      <Route path="sms-gateway" element={<SmsGatewaySettings />} />
      <Route path="firebase" element={<FirebaseSettings />} />
      <Route path="maps" element={<MapsSettings />} />
      <Route path="mail" element={<MailSettings />} />
      <Route path="storage" element={<StorageSettings />} />
      <Route path="notification-channel" element={<NotificationChannelSettings />} />
      <Route
        path="recaptcha"
        element={
          <SimpleProviderCards
            serviceName="recaptcha"
            title="Recaptcha Settings"
            description="Configure Google reCAPTCHA credentials."
          />
        }
      />
      <Route
        path="kyc"
        element={
          <SimpleProviderCards
            serviceName="kyc"
            title="KYC Settings"
            description="Configure KYC verification providers."
          />
        }
      />
    </Route>
    <Route path="app" element={<AdminSettings defaultView="system" />} />
    <Route path="*" element={<AdminSettings />} />
  </Routes>
);

export default SettingsRouter;
