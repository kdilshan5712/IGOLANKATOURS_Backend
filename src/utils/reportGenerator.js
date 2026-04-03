import PDFDocument from 'pdfkit';
import { createObjectCsvStringifier } from 'csv-writer';
import fs from 'fs';
import path from 'path';

/**
 * Report Generator Service
 * Handles PDF and CSV report generation for admin dashboard
 */

/**
 * Reusable Branding Helper for PDF Documents
 */
const drawBranding = (doc) => {
    const logoPath = path.join(process.cwd(), 'src', 'assets', 'Logo.jpg');
    
    // Header Branding
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { height: 60, border_radius: 8 });
    }

    doc.fontSize(20).font('Helvetica-Bold')
        .text('I GO LANKA TOURS', 120, 50);
    
    doc.fontSize(10).font('Helvetica-Oblique')
        .text('An Amazing Destination', 120, 75);

    doc.moveTo(50, 115).lineTo(550, 115).strokeColor('#e5e7eb').lineWidth(1).stroke();
    
    // Page Numbering and Footer (Applied to every page)
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Footer line
        doc.moveTo(50, 750).lineTo(550, 750).strokeColor('#e5e7eb').lineWidth(1).stroke();
        
        const footerY = 760;
        doc.fontSize(8).font('Helvetica').fillColor('#6b7280')
            .text('📞 +94 77 763 9196  |  ✉️ tours.igolanka@gmail.com  |  📍 Katunayaka, Sri Lanka', 50, footerY, { align: 'center' });
        
        doc.text(`Page ${i + 1} of ${range.count}`, 50, footerY + 15, { align: 'center' });
    }
};

/**
 * Generate PDF Report for Bookings
 */
export const generateBookingReportPDF = async (bookings, res) => {
    const doc = new PDFDocument({ margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=booking-report.pdf');

    doc.on('error', (err) => {
        console.error('[PDF] Document error:', err.message);
        if (!res.writableEnded) res.end();
    });

    res.on('error', (err) => {
        console.error('[PDF] Response stream error:', err.message);
        doc.destroy?.();
    });

    doc.pipe(res);

    try {
        // Branding and Title
        doc.moveDown(8);
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#111827')
            .text('Booking Master Report', { align: 'left' });
        doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
            .text(`Generated on: ${new Date().toLocaleString()}`);
        doc.moveDown(2);

        // Table Header
        const tableTop = doc.y;
        const colX = [50, 140, 260, 380, 480];

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151');
        doc.text('Ref ID', colX[0], tableTop);
        doc.text('Customer', colX[1], tableTop);
        doc.text('Package', colX[2], tableTop);
        doc.text('Date', colX[3], tableTop);
        doc.text('Amount', colX[4], tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#374151').lineWidth(0.5).stroke();

        // Table Body
        let y = tableTop + 25;
        doc.font('Helvetica').fillColor('#4b5563');

        bookings.forEach((booking) => {
            if (y > 700) {
                doc.addPage();
                y = 130; // Leave space for header on new pages
            }

            const refId = String(booking.booking_reference || booking.booking_id).substring(0, 10).toUpperCase();
            doc.text(refId, colX[0], y);
            doc.text(booking.tourist_name || 'N/A', colX[1], y, { width: 110, ellipsis: true });
            doc.text(booking.package_name || 'N/A', colX[2], y, { width: 110, ellipsis: true });
            doc.text(new Date(booking.travel_date).toLocaleDateString(), colX[3], y);
            doc.text(`$${Number(booking.total_price).toFixed(2)}`, colX[4], y);

            y += 20;
            doc.moveTo(50, y - 5).lineTo(550, y - 5).strokeColor('#f3f4f6').lineWidth(0.5).stroke();
        });

        // Apply shared branding after all pages are created
        drawBranding(doc);

    } catch (err) {
        console.error('[PDF] Error while building report:', err.message);
    } finally {
        doc.end();
    }
};


/**
 * Generate CSV Report for Bookings
 */
export const generateBookingReportCSV = async (bookings, res) => {
    const csvStringifier = createObjectCsvStringifier({
        header: [
            { id: 'booking_id', title: 'Booking ID' },
            { id: 'tourist_name', title: 'Customer Name' },
            { id: 'package_name', title: 'Package' },
            { id: 'travel_date', title: 'Travel Date' },
            { id: 'total_price', title: 'Amount' },
            { id: 'status', title: 'Status' },
            { id: 'created_at', title: 'Created At' }
        ]
    });

    const records = bookings.map(b => ({
        booking_id: b.booking_id,
        tourist_name: b.tourist_name || 'N/A',
        package_name: b.package_name || 'N/A',
        travel_date: new Date(b.travel_date).toLocaleDateString(),
        total_price: b.total_price,
        status: b.status,
        created_at: new Date(b.created_at).toLocaleString()
    }));

    const header = csvStringifier.getHeaderString();
    const content = csvStringifier.stringifyRecords(records);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=booking-report.csv');
    res.send(header + content);
};

/**
 * Generate CSV Report for Users
 */
export const generateUserReportCSV = async (users, res) => {
    const csvStringifier = createObjectCsvStringifier({
        header: [
            { id: 'user_id', title: 'User ID' },
            { id: 'email', title: 'Email' },
            { id: 'role', title: 'Role' },
            { id: 'full_name', title: 'Name' },
            { id: 'status', title: 'Status' },
            { id: 'created_at', title: 'Joined Date' }
        ]
    });

    const records = users.map(u => ({
        user_id: u.user_id,
        email: u.email,
        role: u.role,
        full_name: u.full_name || 'N/A',
        status: u.status,
        created_at: new Date(u.created_at).toLocaleDateString()
    }));

    const header = csvStringifier.getHeaderString();
    const content = csvStringifier.stringifyRecords(records);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=user-report.csv');
    res.send(header + content);
};

/**
 * Generate PDF Invoice for a Single Booking
 */
export const generateBookingInvoicePDF = async (booking, res) => {
    const doc = new PDFDocument({ margin: 50, bufferPages: true });

    const bookingIdStr = booking.booking_reference || String(booking.booking_id);
    const filename = `Invoice_${bookingIdStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.on('error', (err) => {
        console.error('[PDF INVOICE] Document error:', err.message);
        if (!res.writableEnded) res.end();
    });
    res.on('error', (err) => {
        console.error('[PDF INVOICE] Response stream error:', err.message);
        doc.destroy?.();
    });

    doc.pipe(res);

    // Header Title
    doc.moveDown(8);
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#111827').text('INVOICE', { align: 'right' });
    
    // Invoice Meta Info
    const bookingRef = String(booking.booking_reference || booking.booking_id);
    doc.fontSize(10).font('Helvetica').fillColor('#4b5563')
        .text(`Invoice Date: ${new Date().toLocaleDateString()}`, { align: 'right' })
        .text(`Booking Ref: ${bookingRef}`, { align: 'right' })
        .text(`Status: ${String(booking.status).toUpperCase()}`, { align: 'right', color: '#10b981' });

    doc.moveDown(2);

    // Billing Info Section
    const billedToY = doc.y;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Billed To:', 50, billedToY);
    doc.fontSize(10).font('Helvetica').fillColor('#4b5563').moveDown(0.5)
        .text(booking.tourist_name || 'Valued Customer', 50, doc.y)
        .text(`Email: ${booking.user_email || 'N/A'}`, 50, doc.y);

    doc.moveDown(3);

    // Summary Table Header
    const tableTop = doc.y;
    const colX = [50, 250, 350, 450];

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151');
    doc.text('Description', colX[0], tableTop);
    doc.text('Travelers', colX[1], tableTop);
    doc.text('Travel Date', colX[2], tableTop);
    doc.text('Amount', colX[3], tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#374151').lineWidth(0.5).stroke();

    // Summary Table Body
    const itemY = tableTop + 25;
    doc.font('Helvetica').fillColor('#4b5563');
    doc.text(`Tour Package: ${booking.package_name || 'N/A'}`, colX[0], itemY, { width: 180 });
    doc.text(`${booking.num_people || 'N/A'}`, colX[1], itemY);
    doc.text(`${new Date(booking.travel_date).toLocaleDateString()}`, colX[2], itemY);
    doc.text(`$${Number(booking.total_price).toFixed(2)}`, colX[3], itemY);

    // Totals Section
    doc.moveDown(4);
    const totalsY = doc.y;
    doc.moveTo(300, totalsY).lineTo(550, totalsY).strokeColor('#e5e7eb').stroke();
    
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827');
    doc.text('Total Amount Paid:', 300, doc.y, { align: 'left' });
    doc.text(`$${Number(booking.total_price).toFixed(2)}`, 450, doc.y - 12, { align: 'right' });

    // Payment Note
    if (booking.deposit_amount) {
        doc.fontSize(9).font('Helvetica').fillColor('#6b7280').moveDown(1)
            .text(`Deposit Paid: $${Number(booking.deposit_amount).toFixed(2)}`, 300, doc.y, { align: 'left' })
            .text(`Balance Remaining: $${Number(booking.balance_amount || 0).toFixed(2)}`, 300, doc.y, { align: 'left' });
    }

    // Thank You Note
    doc.moveDown(6);
    doc.font('Helvetica-Oblique').fontSize(11).fillColor('#1e40af')
        .text('Thank you for choosing I Go Lanka Tours!', { align: 'center' });
    doc.fontSize(9).fillColor('#6b7280')
        .text('We hope you have a spectacular journey through the wonders of Sri Lanka.', { align: 'center', margin: 10 });

    // Apply shared branding after all content is drawn
    drawBranding(doc);

    doc.end();
};

/**
 * Generate PDF Report for Revenue
 */
export const generateRevenueReportPDF = async (reportData, res) => {
    const doc = new PDFDocument({ margin: 50, bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=revenue-report.pdf');

    doc.on('error', (err) => {
        console.error('[PDF] Document error:', err.message);
        if (!res.writableEnded) res.end();
    });

    res.on('error', (err) => {
        console.error('[PDF] Response stream error:', err.message);
        doc.destroy?.();
    });

    doc.pipe(res);

    try {
        // Branding and Title
        doc.moveDown(8);
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#111827')
            .text('Revenue Analytics Report', { align: 'left' });
        doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
            .text(`Generated on: ${new Date().toLocaleString()}`);
        doc.moveDown(2);

        // Summary Section
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
            .text('Financial Summary');
        doc.moveTo(50, doc.y + 2).lineTo(550, doc.y + 2).strokeColor('#e5e7eb').lineWidth(1).stroke();
        doc.moveDown(1);

        const summary = reportData.summary;
        const summaryY = doc.y;
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151');
        doc.text('Total Bookings:', 50, summaryY);
        doc.text('Total Revenue:', 200, summaryY);
        doc.text('Completed Revenue:', 350, summaryY);
        doc.text('Avg Booking Value:', 50, summaryY + 20);

        doc.font('Helvetica').fillColor('#4b5563');
        doc.text(`${summary.total_bookings}`, 130, summaryY);
        doc.text(`$${Number(summary.total_revenue).toFixed(2)}`, 280, summaryY);
        doc.text(`$${Number(summary.completed_revenue).toFixed(2)}`, 450, summaryY);
        doc.text(`$${Number(summary.average_booking_value).toFixed(2)}`, 160, summaryY + 20);

        doc.moveDown(3);

        // Revenue by Status Table
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
            .text('Revenue by Booking Status');
        doc.moveDown(0.5);

        const statusTableTop = doc.y;
        const statusCols = [50, 200, 350];
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151');
        doc.text('Status', statusCols[0], statusTableTop);
        doc.text('Bookings', statusCols[1], statusTableTop);
        doc.text('Revenue', statusCols[2], statusTableTop);
        
        doc.moveTo(50, statusTableTop + 15).lineTo(450, statusTableTop + 15).strokeColor('#374151').lineWidth(0.5).stroke();
        
        let currentY = statusTableTop + 25;
        doc.font('Helvetica').fillColor('#4b5563');

        reportData.by_status.forEach((item) => {
            doc.text(item.status.toUpperCase(), statusCols[0], currentY);
            doc.text(`${item.bookings_count}`, statusCols[1], currentY);
            doc.text(`$${Number(item.revenue).toFixed(2)}`, statusCols[2], currentY);
            currentY += 20;
        });

        doc.moveDown(2);

        // Revenue by Package Table (Top 10)
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827')
            .text('Revenue by Tour Package (Top 10)');
        doc.moveDown(0.5);

        const packageTableTop = doc.y;
        const packageCols = [50, 250, 350, 450];

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151');
        doc.text('Package', packageCols[0], packageTableTop);
        doc.text('Bookings', packageCols[1], packageTableTop);
        doc.text('Revenue', packageCols[2], packageTableTop);
        doc.text('Avg. Price', packageCols[3], packageTableTop);

        doc.moveTo(50, packageTableTop + 15).lineTo(550, packageTableTop + 15).strokeColor('#374151').lineWidth(0.5).stroke();

        currentY = packageTableTop + 25;
        doc.font('Helvetica').fillColor('#4b5563');

        reportData.by_package.slice(0, 10).forEach((item) => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 130;
            }
            doc.text(item.package_name, packageCols[0], currentY, { width: 190, ellipsis: true });
            doc.text(`${item.bookings_count}`, packageCols[1], currentY);
            doc.text(`$${Number(item.revenue).toFixed(2)}`, packageCols[2], currentY);
            doc.text(`$${Number(item.average_price).toFixed(2)}`, packageCols[3], currentY);
            currentY += 20;
        });

        // Apply shared branding after all pages are created
        drawBranding(doc);

    } catch (err) {
        console.error('[PDF] Error while building revenue report:', err.message);
    } finally {
        doc.end();
    }
};

/**
 * Generate CSV Report for Revenue
 */
export const generateRevenueReportCSV = async (reportData, res) => {
    // We'll create a multi-section CSV or just the package breakdown
    const csvStringifier = createObjectCsvStringifier({
        header: [
            { id: 'package_name', title: 'Package Name' },
            { id: 'bookings_count', title: 'Bookings' },
            { id: 'revenue', title: 'Total Revenue' },
            { id: 'average_price', title: 'Average Booking Value' }
        ]
    });

    const records = reportData.by_package.map(p => ({
        package_name: p.package_name,
        bookings_count: p.bookings_count,
        revenue: p.revenue,
        average_price: p.average_price
    }));

    const header = csvStringifier.getHeaderString();
    const content = csvStringifier.stringifyRecords(records);

    // Add summary header at the top
    const summary = reportData.summary;
    const summarySection = `REVENUE SUMMARY\n` +
        `Total Bookings,${summary.total_bookings}\n` +
        `Total Revenue,${summary.total_revenue}\n` +
        `Completed Revenue,${summary.completed_revenue}\n` +
        `Avg Booking Value,${summary.average_booking_value}\n\n` +
        `BREAKDOWN BY PACKAGE\n`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=revenue-report.csv');
    res.send(summarySection + header + content);
};

export default {
    generateBookingReportPDF,
    generateBookingReportCSV,
    generateUserReportCSV,
    generateBookingInvoicePDF,
    generateRevenueReportPDF,
    generateRevenueReportCSV
};
