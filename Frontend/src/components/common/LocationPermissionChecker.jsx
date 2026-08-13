// Location Permission Checker Component for Truliq
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import flutterBridge from '../../utils/flutterBridge';
import { getGeolocationPermissionState, isGpsOffError, getCachedAddress } from '../../utils/locationHelper';

export const LocationPermissionChecker = () => {
    useEffect(() => {
        const checkPermission = async (isManualTrigger = false) => {
            const hasGrantedPreviously = localStorage.getItem('location_granted') === 'true';
            const cachedAddress = getCachedAddress();

            // If manual trigger (user clicked "Use Current Location" or "Change Location"), try to get location
            if (isManualTrigger) {
                try {
                    const location = await flutterBridge.getCurrentLocation();
                    localStorage.setItem('location_granted', 'true');
                    window.dispatchEvent(new CustomEvent('deviceGpsStatusChanged', { detail: { isGpsOff: false } }));
                    window.dispatchEvent(new CustomEvent('locationUpdate', { detail: location }));
                } catch (err) {
                    if (isGpsOffError(err)) {
                        window.dispatchEvent(new CustomEvent('deviceGpsStatusChanged', { detail: { isGpsOff: true } }));
                        toast.error("Device location (GPS) is turned off. Please turn on GPS.", { id: 'gps-off-toast' });
                    } else {
                        toast.error("Please enable location permissions in your browser/device settings.");
                    }
                }
                return;
            }

            // If we ALREADY have a saved location/address, do NOT trigger geolocation on startup on web browser!
            // This prevents the browser dialog "www.truliq.com would like to use your current location" from appearing every time.
            const permState = await getGeolocationPermissionState();

            if (cachedAddress && permState !== 'granted' && !flutterBridge.isFlutter) {
                // Saved location exists; automatically use it without showing any prompt dialog!
                return;
            }

            // Only fetch silently if permission was already granted or running inside Flutter app
            if (permState === 'granted' || flutterBridge.isFlutter) {
                try {
                    const location = await flutterBridge.getCurrentLocation();
                    localStorage.setItem('location_granted', 'true');
                    window.dispatchEvent(new CustomEvent('deviceGpsStatusChanged', { detail: { isGpsOff: false } }));
                } catch (err) {
                    if (isGpsOffError(err)) {
                        window.dispatchEvent(new CustomEvent('deviceGpsStatusChanged', { detail: { isGpsOff: true } }));
                    }
                }
            }
        };

        // Delay execution to ensure Flutter WebView is fully ready
        const timer = setTimeout(() => {
            checkPermission(false);
        }, 1500);

        // Global listener for manual triggers
        const handleManualTrigger = () => {
            console.log('Manual location trigger received');
            checkPermission(true);
        };
        window.addEventListener('requestLocationPrompt', handleManualTrigger);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('requestLocationPrompt', handleManualTrigger);
        };
    }, []);

    return null;
};


