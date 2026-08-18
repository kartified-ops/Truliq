import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import NotificationsLayout from './NotificationsLayout';
import SendPushNotification from './SendPushNotification';
import NotificationHistory from './NotificationHistory';
import AdminInbox from './AdminInbox';

const Notifications = () => (
  <Routes>
    <Route element={<NotificationsLayout />}>
      <Route index element={<Navigate to="send" replace />} />
      <Route path="send" element={<SendPushNotification />} />
      <Route path="history" element={<NotificationHistory />} />
      <Route path="inbox" element={<AdminInbox />} />
    </Route>
  </Routes>
);

export default Notifications;
