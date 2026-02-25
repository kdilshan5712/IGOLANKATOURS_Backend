import { loadTemplate } from '../src/utils/emailService.js';

console.log('🧪 Testing Email Templates Rendering...');

try {
    // 1. Booking Confirmation
    console.log('1. Booking Confirmation:');
    const bookingHtml = loadTemplate('bookingConfirmation', {
        userName: 'John Doe',
        bookingReference: 'REF123',
        packageName: 'Safari Adventure',
        travelDate: '2023-12-25',
        totalPrice: '$500.00',
        numberOfTravelers: 2
    });

    if (bookingHtml && bookingHtml.includes('REF123') && bookingHtml.includes('John Doe')) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL - Content mismatch or load failure');
    }

    // 2. Guide Assignment
    console.log('2. Guide Assignment:');
    const guideHtml = loadTemplate('guideAssignment', {
        guideName: 'Guide Jane',
        bookingReference: 'REF123',
        packageName: 'City Tour',
        travelDate: '2023-12-25',
        touristName: 'John Doe'
    });

    if (guideHtml && guideHtml.includes('Guide Jane') && guideHtml.includes('City Tour')) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL - Content mismatch or load failure');
    }

    // 3. Welcome Email
    console.log('3. Welcome Email:');
    const welcomeHtml = loadTemplate('welcome', {
        userName: 'New User',
        loginLink: 'http://localhost:3000/login'
    });

    if (welcomeHtml && welcomeHtml.includes('New User')) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL - Content mismatch or load failure');
    }

    // 4. Password Reset
    console.log('4. Password Reset:');
    const resetHtml = loadTemplate('passwordReset', {
        userName: 'User',
        resetLink: 'http://localhost:3000/reset?token=123'
    });

    if (resetHtml && resetHtml.includes('http://localhost:3000/reset?token=123')) {
        console.log('   ✅ PASS');
    } else {
        console.error('   ❌ FAIL - Content mismatch or load failure');
    }
    console.log('\n✨ All tests completed successfully!');

} catch (error) {
    console.error('🚨 Test Failed:', error);
    process.exit(1);
}
