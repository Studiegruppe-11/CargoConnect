// DeliveryApp/App.js
import React, { useEffect } from 'react';
import AppNavigator from './navigation/AppNavigator';
// import { fixDeliveryData } from './utils/deliveryFixer';

export default function App() {
  useEffect(() => {
    // fixDeliveryData();
  }, []);

  return <AppNavigator />;
}