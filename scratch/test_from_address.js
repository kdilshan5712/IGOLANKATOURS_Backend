import 'dotenv/config';
import nodemailer from 'nodemailer';

// Mocking the getFromAddress logic from emailService.js
const getFromAddress = () => {
    if (process.env.EMAIL_FROM) {
        return process.env.EMAIL_FROM;
    }
    const name = process.env.EMAIL_FROM_NAME || 'I GO LANKA TOURS';
    const user = process.env.EMAIL_USER || 'tours.igolanka@gmail.com';
    return `${name} <${user}>`;
};

console.log('--- Testing getFromAddress Logic ---');
console.log('EMAIL_FROM in env:', process.env.EMAIL_FROM);
console.log('EMAIL_USER in env:', process.env.EMAIL_USER);
console.log('Resulting From Address:', getFromAddress());

if (getFromAddress() === process.env.EMAIL_FROM) {
    console.log('✅ PASS: Correctly using EMAIL_FROM');
} else {
    console.log('❌ FAIL: Not using EMAIL_FROM');
}
