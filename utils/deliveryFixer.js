import { getDatabase, ref, get, update } from 'firebase/database';

const possibleStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

export const fixDeliveryData = async () => {
  const db = getDatabase();
  const usersRef = ref(db, 'users');
  const deliveriesRef = ref(db, 'deliveries');

  try {
    // Get all users and deliveries
    const [usersSnapshot, deliveriesSnapshot] = await Promise.all([
      get(usersRef),
      get(deliveriesRef)
    ]);

    const users = usersSnapshot.val();
    const deliveries = deliveriesSnapshot.val();

    // Get company users
    const companyUsers = Object.entries(users)
      .filter(([_, user]) => user.role === 'company')
      .map(([id]) => id);

    if (!companyUsers.length) {
      console.error('No company users found');
      return;
    }

    // Fix each delivery
    for (const [deliveryId, delivery] of Object.entries(deliveries)) {
      const updates = {};

      // Add random company ID if missing
      if (!delivery.companyId) {
        const randomCompanyId = companyUsers[Math.floor(Math.random() * companyUsers.length)];
        updates.companyId = randomCompanyId;
      }

      // Add random status if missing
      if (!delivery.status) {
        const randomStatus = possibleStatuses[Math.floor(Math.random() * possibleStatuses.length)];
        updates.status = randomStatus;
      }

      // Fix negative costs
      if (delivery.payment < 0) {
        updates.payment = Math.abs(delivery.payment);
      }
      if (delivery.prize < 0) {
        updates.prize = Math.abs(delivery.prize);
      }

      // Update the delivery if any changes needed
      if (Object.keys(updates).length > 0) {
        await update(ref(db, `deliveries/${deliveryId}`), updates);
        console.log(`Fixed delivery ${deliveryId}:`, updates);
      }
    }

    console.log('Finished fixing delivery data');
  } catch (error) {
    console.error('Error fixing delivery data:', error);
  }
};

// Auto-run the fix
fixDeliveryData();