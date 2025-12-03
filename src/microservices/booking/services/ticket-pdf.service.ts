import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument = require('pdfkit');
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { Booking } from 'src/shared/entities/booking/booking.entity';
import { Ticket } from 'src/shared/entities/ticket/ticket.entity';

/**
 * Ticket PDF Service
 * Generates PDF tickets for bookings and saves them to server storage
 * Naming convention: booking_{booking_code}_ticket_{ticket_number}.pdf
 */
@Injectable()
export class TicketPdfService {
	private readonly logger = new Logger(TicketPdfService.name);
	private readonly ticketsStoragePath: string;

	constructor(private readonly configService: ConfigService) {
		// Get storage path from config or use default
		this.ticketsStoragePath =
			this.configService.get<string>('TICKETS_PDF_STORAGE_PATH') ||
			resolve(process.cwd(), 'storage', 'tickets-pdf');

		// Ensure storage directory exists
		if (!existsSync(this.ticketsStoragePath)) {
			mkdirSync(this.ticketsStoragePath, { recursive: true });
			this.logger.log(`Created tickets PDF storage directory: ${this.ticketsStoragePath}`);
		}
	}

	/**
	 * Generate PDF ticket for a single ticket
	 * Returns the file path of the generated PDF
	 */
	async generateTicketPdf(booking: Booking, ticket: Ticket): Promise<string> {
		this.logger.log(`Generating PDF for ticket ${ticket.ticket_number} (booking ${booking.pnr_code})`);

		try {
			// Generate file name: booking_{booking_code}_ticket_{ticket_number}.pdf
			const fileName = `booking_${booking.pnr_code}_ticket_${ticket.ticket_number}.pdf`;
			const filePath = join(this.ticketsStoragePath, fileName);

			// Create PDF document
			const doc = new PDFDocument({
				size: 'A4',
				margin: 50,
			});

			// Create write stream
			const stream = createWriteStream(filePath);
			doc.pipe(stream);

			// Generate PDF content
			this.generatePdfContent(doc, booking, ticket);

			// Finalize PDF
			doc.end();

			// Wait for stream to finish
			await new Promise<void>((resolve, reject) => {
				stream.on('finish', () => {
					this.logger.log(`PDF ticket generated successfully: ${filePath}`);
					resolve();
				});
				stream.on('error', (error) => {
					this.logger.error(`Error generating PDF: ${error.message}`);
					reject(error);
				});
			});

			return filePath;
		} catch (error: any) {
			this.logger.error(`Failed to generate PDF ticket: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Generate PDF tickets for all tickets in a booking
	 * Returns array of file paths
	 */
	async generateAllTicketsPdf(booking: Booking, tickets: Ticket[]): Promise<string[]> {
		this.logger.log(`Generating PDFs for ${tickets.length} tickets (booking ${booking.pnr_code})`);

		const filePaths: string[] = [];

		for (const ticket of tickets) {
			try {
				const filePath = await this.generateTicketPdf(booking, ticket);
				filePaths.push(filePath);
			} catch (error: any) {
				this.logger.error(
					`Failed to generate PDF for ticket ${ticket.ticket_number}: ${error.message}`,
				);
				// Continue with other tickets even if one fails
			}
		}

		return filePaths;
	}

	/**
	 * Generate PDF content
	 */
	private generatePdfContent(doc: typeof PDFDocument.prototype, booking: Booking, ticket: Ticket): void {
		// Find the segment and passenger for this ticket
		const segment = booking.booking_segments?.find(
			(s) => s.booking_passenger.booking_passenger_id === ticket.booking_passenger.booking_passenger_id,
		);

		if (!segment) {
			throw new Error(`Segment not found for ticket ${ticket.ticket_number}`);
		}

		const passenger = segment.booking_passenger.passenger;
		const flightInstance = segment.flight_instance;
		const schedule = flightInstance?.flight_schedule;
		const route = schedule?.route;
		const originAirport = route?.origin_airport;
		const destinationAirport = route?.destination_airport;
		const fareClass = segment.fare_class;
		const seat = segment.flight_seat;

		// Header
		doc.fontSize(24).font('Helvetica-Bold').text('VÉ MÁY BAY', { align: 'center' });
		doc.moveDown(0.5);

		// Ticket Number
		doc.fontSize(18).font('Helvetica-Bold').text(`Số vé: ${ticket.ticket_number}`, { align: 'center' });
		doc.moveDown(1);

		// Booking Code
		doc.fontSize(14).font('Helvetica').text(`Mã đặt chỗ: ${booking.pnr_code}`, { align: 'center' });
		doc.moveDown(1.5);

		// Passenger Information
		doc.fontSize(16).font('Helvetica-Bold').text('THÔNG TIN HÀNH KHÁCH', { underline: true });
		doc.moveDown(0.5);
		doc.fontSize(12).font('Helvetica');
		doc.text(`Họ và tên: ${passenger?.fullname || booking.contact_fullname || 'N/A'}`);
		doc.text(`Ngày sinh: ${passenger?.dob ? new Date(passenger.dob).toLocaleDateString('vi-VN') : 'N/A'}`);
		doc.text(`Giới tính: ${passenger?.gender === 'M' ? 'Nam' : passenger?.gender === 'F' ? 'Nữ' : 'N/A'}`);
		doc.text(`Số CMND/Passport: ${passenger?.document_number || 'N/A'}`);
		doc.moveDown(1);

		// Flight Information
		doc.fontSize(16).font('Helvetica-Bold').text('THÔNG TIN CHUYẾN BAY', { underline: true });
		doc.moveDown(0.5);
		doc.fontSize(12).font('Helvetica');

		if (schedule && originAirport && destinationAirport) {
			doc.text(`Số hiệu chuyến bay: ${schedule.flight_number || flightInstance?.flight_number || 'N/A'}`);
			doc.text(`Từ: ${originAirport.iata_code || originAirport.name} - ${originAirport.name || ''}`);
			doc.text(`Đến: ${destinationAirport.iata_code || destinationAirport.name} - ${destinationAirport.name || ''}`);

			if (flightInstance?.departure_datetime_local) {
				const depTime = new Date(flightInstance.departure_datetime_local);
				doc.text(
					`Giờ khởi hành: ${depTime.toLocaleString('vi-VN', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					})}`,
				);
			}

			if (flightInstance?.arrival_datetime_local) {
				const arrTime = new Date(flightInstance.arrival_datetime_local);
				doc.text(
					`Giờ đến nơi: ${arrTime.toLocaleString('vi-VN', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					})}`,
				);
			}
		}

		doc.moveDown(0.5);
		doc.text(`Hạng vé: ${fareClass?.description || fareClass?.fare_class_code || 'N/A'}`);
		doc.text(`Ghế ngồi: ${seat?.seat_number || 'Chưa chọn'}`);
		doc.moveDown(1);

		// Booking Information
		doc.fontSize(16).font('Helvetica-Bold').text('THÔNG TIN ĐẶT CHỖ', { underline: true });
		doc.moveDown(0.5);
		doc.fontSize(12).font('Helvetica');
		doc.text(`Ngày phát hành: ${ticket.issued_at ? new Date(ticket.issued_at).toLocaleDateString('vi-VN') : 'N/A'}`);
		doc.text(`Trạng thái: ${ticket.status === 'active' ? 'Có hiệu lực' : ticket.status}`);
		doc.text(`Tổng tiền: ${booking.total_amount?.toLocaleString('vi-VN') || '0'} ${booking.currency?.currency_code || 'VND'}`);
		doc.moveDown(1);

		// Footer
		doc.fontSize(10).font('Helvetica-Oblique').text(
			'Vui lòng có mặt tại sân bay trước giờ khởi hành ít nhất 2 giờ (nội địa) hoặc 3 giờ (quốc tế)',
			{ align: 'center' },
		);
		doc.moveDown(0.5);
		doc.text('Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!', { align: 'center' });
	}

	/**
	 * Get file path for a ticket PDF (without generating it)
	 */
	getTicketPdfPath(booking: Booking, ticket: Ticket): string {
		const fileName = `booking_${booking.pnr_code}_ticket_${ticket.ticket_number}.pdf`;
		return join(this.ticketsStoragePath, fileName);
	}

	/**
	 * Check if PDF exists for a ticket
	 */
	ticketPdfExists(booking: Booking, ticket: Ticket): boolean {
		const filePath = this.getTicketPdfPath(booking, ticket);
		return existsSync(filePath);
	}
}

