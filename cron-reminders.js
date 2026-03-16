import reminderService from './src/services/reminder.service.js';

/**
 * Daily Reminder Script
 * This script should be scheduled to run once a day.
 */

async function run() {
    console.log("⏰ Starting daily payment reminder task...");
    const result = await reminderService.sendBalanceReminders();
    
    if (result.success) {
        console.log(`✅ Task completed. Sent ${result.count} reminders.`);
    } else {
        console.log(`❌ Task failed: ${result.error}`);
    }
    
    process.exit(0);
}

run();
