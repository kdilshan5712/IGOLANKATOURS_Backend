import pool from '../src/config/db.js';

const createFaqsTable = async () => {
    try {
        console.log('Creating faqs table...');

        const query = `
      CREATE TABLE IF NOT EXISTS faqs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(100) NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

        await pool.query(query);
        console.log('✅ faqs table created successfully');

        // Seed initial data
        const checkQuery = await pool.query('SELECT count(*) FROM faqs');
        if (parseInt(checkQuery.rows[0].count) === 0) {
            console.log('Inserting initial FAQs...');
            const seedQuery = `
        INSERT INTO faqs (category, question, answer) VALUES
        ('Booking & Payments', 'How do I book a tour with I GO LANKA?', 'Booking is easy! Simply browse our Tour Packages, select your desired tour, click ''Book Now'', choose your travel dates and number of travelers, and follow the secure checkout process. You can also contact us for custom bookings.'),
        ('Booking & Payments', 'Is my payment information secure?', 'Yes. We use industry-standard encryption for all transactions. Your payment details are never stored on our servers, ensuring complete privacy and security.'),
        ('Booking & Payments', 'What is your cancellation policy?', 'Free cancellation is available up to 14 days before your tour start date. Cancellations made within 14 days may be subject to partial fees. Please refer to our full Cancellation Policy page for detailed terms.'),
        ('Booking & Payments', 'Do you require a deposit?', 'For most multi-day tours, we require a 20% deposit at the time of booking to secure your hotels and transportation. The remaining balance is typically due 30 days before arrival.'),
        ('Tours & Travel', 'Are flights included in the tour packages?', 'No, international airfare to and from Sri Lanka is not included in our tour packages. However, all domestic transportation outlined in the itinerary is fully covered.'),
        ('Tours & Travel', 'Do I need a visa to visit Sri Lanka?', 'Most nationalities require an Electronic Travel Authorization (ETA) to enter Sri Lanka. You can easily apply for this online before your trip at the official government website. We recommend arranging this at least a week before travel.'),
        ('Tours & Travel', 'What language do the tour guides speak?', 'All our standard tours are conducted by professional, certified English-speaking chauffeur guides. Guides proficient in other languages (German, French, Spanish, etc.) can be arranged upon request subject to availability.'),
        ('Tours & Travel', 'Can I customize an existing tour package?', 'Absolutely! We specialize in tailor-made experiences. If you see a package you like but want to change hotels, extend your stay, or add specific activities, just click the ''Customize Tour'' button on the package page.'),
        ('Practical Information', 'What is the best time to visit Sri Lanka?', 'Sri Lanka is a year-round destination! The best time for the West and South coasts is from December to March. For the East coast, May to September is ideal. The Cultural Triangle is generally good most of the year.'),
        ('Practical Information', 'What kind of clothing should I pack?', 'Light, breathable cotton or linen clothing is best for the tropical climate. When visiting temples, you must cover your shoulders and knees. Remember to pack a light jacket or sweater if you are visiting the Hill Country (Nuwara Eliya), as it gets chilly at night.'),
        ('Practical Information', 'Is it safe to drink tap water in Sri Lanka?', 'We advise against drinking tap water. Bottled water is cheap, widely available, and provided daily during our guided tours. Safe, filtered water is also available at most hotels.')
      `;
            await pool.query(seedQuery);
            console.log('✅ Initial FAQs inserted');
        }

    } catch (error) {
        console.error('❌ Error creating faqs table:', error);
    } finally {
        process.exit();
    }
};

createFaqsTable();
