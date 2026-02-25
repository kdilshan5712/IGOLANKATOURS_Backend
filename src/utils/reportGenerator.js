import PDFDocument from 'pdfkit';
import { createObjectCsvStringifier } from 'csv-writer';
import fs from 'fs';
import path from 'path';

/**
 * Report Generator Service
 * Handles PDF and CSV report generation for admin dashboard
 */

/**
 * Generate PDF Report for Bookings
 */
export const generateBookingReportPDF = async (bookings, res) => {
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=booking-report.pdf');

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('I Go Lanka Tours - Booking Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    // Table Header
    const tableTop = 150;
    const colX = [50, 150, 250, 350, 450];

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Ref ID', colX[0], tableTop);
    doc.text('Customer', colX[1], tableTop);
    doc.text('Package', colX[2], tableTop);
    doc.text('Date', colX[3], tableTop);
    doc.text('Amount', colX[4], tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table Body
    let y = tableTop + 25;
    doc.font('Helvetica');

    bookings.forEach((booking) => {
        // Check if new page needed
        if (y > 700) {
            doc.addPage();
            y = 50;
        }

        doc.text(booking.booking_id.substring(0, 8).toUpperCase(), colX[0], y);
        doc.text(booking.tourist_name || 'N/A', colX[1], y, { width: 90, ellipsis: true });
        doc.text(booking.package_name || 'N/A', colX[2], y, { width: 90, ellipsis: true });
        doc.text(new Date(booking.travel_date).toLocaleDateString(), colX[3], y);
        doc.text(`$${booking.total_price}`, colX[4], y);

        y += 20;
    });

    // Footer
    doc.end();
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
    const doc = new PDFDocument({ margin: 50 });

    const filename = `Invoice_${booking.booking_reference || booking.booking_id.substring(0, 8)}.pdf`;

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
    doc.moveDown();

    // Company Info
    doc.fontSize(10).font('Helvetica')
        .text('I Go Lanka Tours', 50, doc.y)
        .text('Colombo, Sri Lanka', 50, doc.y + 15)
        .text('Email: info@igolanka.com', 50, doc.y + 30);

    // Invoice Info
    doc.text(`Invoice Date: ${new Date().toLocaleDateString()}`, 400, doc.y - 30, { align: 'right' })
        .text(`Booking Ref: ${booking.booking_reference || booking.booking_id.substring(0, 8).toUpperCase()}`, 400, doc.y, { align: 'right' })
        .text(`Status: Paid (${booking.status.toUpperCase()})`, 400, doc.y, { align: 'right' });

    doc.moveDown(3);

    // Customer Info
    doc.font('Helvetica-Bold').text('Billed To:', 50, doc.y);
    doc.font('Helvetica').moveDown(0.5)
        .text(booking.tourist_name || booking.user_email || 'Valued Customer', 50, doc.y)
        .text(`Email: ${booking.user_email || 'N/A'}`, 50, doc.y);

    doc.moveDown(2);

    // Table Header
    const tableTop = doc.y;
    const colX = [50, 250, 350, 450];

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', colX[0], tableTop);
    doc.text('Travelers', colX[1], tableTop);
    doc.text('Travel Date', colX[2], tableTop);
    doc.text('Amount', colX[3], tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table Body
    const itemY = tableTop + 25;
    doc.font('Helvetica');
    doc.text(`Tour Package: ${booking.package_name || 'N/A'}`, colX[0], itemY, { width: 180 });
    doc.text(`${booking.travelers || 'N/A'}`, colX[1], itemY);
    doc.text(`${new Date(booking.travel_date).toLocaleDateString()}`, colX[2], itemY);
    doc.text(`$${Number(booking.total_price).toFixed(2)}`, colX[3], itemY);

    // Totals Line
    doc.moveTo(50, itemY + 30).lineTo(550, itemY + 30).stroke();

    const totalY = itemY + 45;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total Paid:', colX[2], totalY, { align: 'left' });
    doc.text(`$${Number(booking.total_price).toFixed(2)}`, colX[3], totalY);

    // Footer
    doc.moveDown(5);
    doc.font('Helvetica-Oblique').fontSize(10).text('Thank you for booking with I Go Lanka Tours! We hope you have an amazing journey.', { align: 'center' });

    doc.end();
};

export default {
    generateBookingReportPDF,
    generateBookingReportCSV,
    generateUserReportCSV,
    generateBookingInvoicePDF
};
