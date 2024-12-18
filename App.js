// DeliveryApp/App.js
import React, { useEffect } from 'react';
import AppNavigator from './navigation/AppNavigator';
import { fixDeliveryData } from './utils/deliveryFixer';
import { fixAllNegativeRouteCosts } from './utils/fixRouteCosts';

export default function App() {
  useEffect(() => {
    // fixDeliveryData();
  }, []);

  return <AppNavigator />;
}