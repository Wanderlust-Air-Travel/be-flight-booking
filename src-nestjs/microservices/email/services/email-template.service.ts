import { Injectable, Logger } from '@nestjs/common';
import { EmailTemplate } from 'src/shared/constants/enums';
import { TemplateResult } from '../interfaces/email-template.interface';

@Injectable()
export class EmailTemplateService {
	private readonly logger = new Logger(EmailTemplateService.name);

	/**
	 * Render email template with data
	 */
	async renderTemplate(template: EmailTemplate, data: Record<string, any>): Promise<TemplateResult> {
		switch (template) {
			case EmailTemplate.OTP_PAYMENT:
				return this.renderOtpPaymentTemplate(data);
			case EmailTemplate.OTP_PASSWORD_RESET:
				return this.renderOtpPasswordResetTemplate(data);
			case EmailTemplate.OTP_CANCELLATION:
				return this.renderOtpCancellationTemplate(data);
			case EmailTemplate.PAYMENT_SUCCESS:
				return this.renderPaymentSuccessTemplate(data);
			case EmailTemplate.PAYMENT_FAILED:
				return this.renderPaymentFailedTemplate(data);
			case EmailTemplate.BOOKING_CONFIRMATION:
				return this.renderBookingConfirmationTemplate(data);
			case EmailTemplate.TICKET_CONFIRMATION:
				return this.renderTicketConfirmationTemplate(data);
			case EmailTemplate.BOOKING_CANCELLATION:
				return this.renderBookingCancellationTemplate(data);
			default:
				throw new Error(`Unknown template: ${template}`);
		}
	}

	/**
	 * Render OTP Payment template
	 */
	private renderOtpPaymentTemplate(data: Record<string, any>): TemplateResult {
		const otp = data.otp || 'N/A';
		const expiresIn = data.expiresIn || '15 minutes';

		const subject = 'Xác thực thanh toán - OTP Code';
		const htmlBody = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
		.content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
		.otp-box { background-color: white; border: 2px solid #007bff; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
		.otp-code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
		.warning { color: #dc3545; font-weight: bold; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Xác thực thanh toán</h1>
		</div>
		<div class="content">
			<p>Xin chào,</p>
			<p>Bạn đang thực hiện giao dịch thanh toán. Vui lòng sử dụng mã OTP sau để xác thực:</p>
			<div class="otp-box">
				<div class="otp-code">${otp}</div>
			</div>
			<p class="warning">⚠️ Mã OTP này có hiệu lực trong ${expiresIn}. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
			<p>Nếu bạn không thực hiện giao dịch này, vui lòng bỏ qua email này.</p>
			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const textBody = `Xác thực thanh toán\n\nMã OTP của bạn là: ${otp}\n\nMã này có hiệu lực trong ${expiresIn}. Vui lòng không chia sẻ mã này với bất kỳ ai.`;

		return { subject, htmlBody, textBody };
	}

	/**
	 * Render OTP Password Reset template
	 */
	private renderOtpPasswordResetTemplate(data: Record<string, any>): TemplateResult {
		const otp = data.otp || 'N/A';
		const expiresIn = data.expiresIn || '15 minutes';

		const subject = 'Đặt lại mật khẩu - OTP Code';
		const htmlBody = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
		.content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
		.otp-box { background-color: white; border: 2px solid #28a745; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
		.otp-code { font-size: 32px; font-weight: bold; color: #28a745; letter-spacing: 5px; }
		.warning { color: #dc3545; font-weight: bold; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Đặt lại mật khẩu</h1>
		</div>
		<div class="content">
			<p>Xin chào,</p>
			<p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng sử dụng mã OTP sau:</p>
			<div class="otp-box">
				<div class="otp-code">${otp}</div>
			</div>
			<p class="warning">⚠️ Mã OTP này có hiệu lực trong ${expiresIn}. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
			<p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const textBody = `Đặt lại mật khẩu\n\nMã OTP của bạn là: ${otp}\n\nMã này có hiệu lực trong ${expiresIn}. Vui lòng không chia sẻ mã này với bất kỳ ai.`;

		return { subject, htmlBody, textBody };
	}

	/**
	 * Render Payment Success template
	 */
	private renderPaymentSuccessTemplate(data: Record<string, any>): TemplateResult {
		const pnrCode = data.pnrCode || 'N/A';
		const bookingId = data.bookingId || 'N/A';
		const totalAmount = data.totalAmount || 0;
		const currency = data.currency || 'VND';
		const passengerName = data.passengerName || 'Quý khách';
		const seatDetails = data.seatDetails || 'N/A';
		const checkInTime = data.checkInTime || 'N/A';

		const subject = `Xác nhận thanh toán thành công - Mã đặt chỗ: ${pnrCode}`;
		const htmlBody = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
		.content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
		.info-box { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #28a745; }
		.info-row { margin: 10px 0; }
		.label { font-weight: bold; color: #666; }
		.value { color: #333; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>✓ Thanh toán thành công</h1>
		</div>
		<div class="content">
			<p>Xin chào <strong>${passengerName}</strong>,</p>
			<p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi. Giao dịch thanh toán của bạn đã được xử lý thành công.</p>
			<div class="info-box">
				<div class="info-row">
					<span class="label">Mã đặt chỗ (PNR):</span>
					<span class="value"><strong>${pnrCode}</strong></span>
				</div>
				<div class="info-row">
					<span class="label">Mã booking:</span>
					<span class="value">${bookingId}</span>
				</div>
				<div class="info-row">
					<span class="label">Tổng tiền:</span>
					<span class="value"><strong>${totalAmount.toLocaleString()} ${currency}</strong></span>
				</div>
				<div class="info-row">
					<span class="label">Thông tin chỗ ngồi:</span>
					<div class="value">
						${
							seatDetails !== 'N/A'
								? seatDetails
										.split('\n\n')
										.map(
											(block) => {
												// Check if this block contains "Sẽ được chọn khi làm thủ tục check-in"
												const hasSeatToBeSelected = block.includes('Sẽ được chọn khi làm thủ tục check-in');
												const blockLines = block.split('\n');
												const formattedLines = blockLines.map((line) => {
													// Highlight seat selection notice
													if (line.includes('Sẽ được chọn khi làm thủ tục check-in')) {
														return `<p style="margin: 2px 0; color: #856404; font-style: italic;">${line}</p>`;
													}
													return `<p style="margin: 2px 0;">${line}</p>`;
												}).join('');
												
												return `
							<div style="margin: 8px 0; padding: 8px; background-color: ${hasSeatToBeSelected ? '#fff3cd' : '#f5f5f5'}; border-radius: 4px; ${hasSeatToBeSelected ? 'border-left: 3px solid #ffc107;' : ''}">
								${formattedLines}
							</div>`;
											},
										)
										.join('')
								: '<p>Không có thông tin chỗ ngồi.</p>'
						}
					</div>
				</div>
				<div class="info-row" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
					<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
						<div style="font-weight: bold; margin-bottom: 8px; color: #856404;">⏰ Lưu ý làm thủ tục:</div>
						<p style="margin: 10px 0 0 0; color: #856404; font-size: 13px;">
							${
								seatDetails !== 'N/A' && seatDetails.includes('Sẽ được chọn khi làm thủ tục check-in')
									? '<strong>Quan trọng:</strong> Số ghế ngồi sẽ được chọn khi bạn làm thủ tục check-in. Vui lòng có mặt tại sân bay đúng giờ để làm thủ tục check-in và chọn ghế ngồi. '
									: ''
							}
							Vui lòng có mặt tại sân bay đúng giờ để làm thủ tục check-in. 
							Vui lòng có mặt trước giờ khởi hành ít nhất 24 giờ để làm thủ tục.
						</p>
					</div>
				</div>
			</div>
			<p>Thông tin chi tiết về chuyến bay và chỗ ngồi đã được gửi kèm theo email này. Vui lòng kiểm tra email và lưu lại mã đặt chỗ để sử dụng tại sân bay.</p>
			<p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email hoặc hotline.</p>
			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
				<p>© 2025 Flight Booking System. All rights reserved.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const hasSeatToBeSelected = seatDetails !== 'N/A' && seatDetails.includes('Sẽ được chọn khi làm thủ tục check-in');
		const checkInNote = hasSeatToBeSelected
			? 'QUAN TRỌNG: Số ghế ngồi sẽ được chọn khi bạn làm thủ tục check-in. '
			: '';

		const textBody = `Thanh toán thành công

Mã đặt chỗ (PNR): ${pnrCode}
Mã booking: ${bookingId}
Tổng tiền: ${totalAmount.toLocaleString()} ${currency}

Thông tin chỗ ngồi:
${seatDetails}

${checkInNote}Vui lòng có mặt tại sân bay đúng giờ để làm thủ tục check-in. 
Vui lòng có mặt trước giờ khởi hành ít nhất 24 giờ để làm thủ tục.

Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.`;

		return { subject, htmlBody, textBody };
	}

	/**
	 * Render Payment Failed template
	 */
	private renderPaymentFailedTemplate(data: Record<string, any>): TemplateResult {
		const bookingId = data.bookingId || 'N/A';
		const reason = data.reason || 'Không xác định';

		const subject = 'Thông báo thanh toán thất bại';
		const htmlBody = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
		.content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
		.warning-box { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>⚠ Thanh toán thất bại</h1>
		</div>
		<div class="content">
			<p>Xin chào,</p>
			<p>Chúng tôi rất tiếc thông báo rằng giao dịch thanh toán của bạn không thể được xử lý.</p>
			<div class="warning-box">
				<p><strong>Mã booking:</strong> ${bookingId}</p>
				<p><strong>Lý do:</strong> ${reason}</p>
			</div>
			<p>Vui lòng thử lại hoặc liên hệ với chúng tôi nếu vấn đề vẫn tiếp tục.</p>
			<p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email hoặc hotline.</p>
			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const textBody = `Thanh toán thất bại\n\nMã booking: ${bookingId}\nLý do: ${reason}\n\nVui lòng thử lại hoặc liên hệ với chúng tôi nếu vấn đề vẫn tiếp tục.`;

		return { subject, htmlBody, textBody };
	}

	/**
	 * Render Booking Confirmation template
	 * This email is sent immediately after booking creation (before check-in)
	 * So it should not include ticket details yet
	 */
	private renderBookingConfirmationTemplate(data: Record<string, any>): TemplateResult {
		const pnrCode = data.pnrCode || 'N/A';
		const bookingId = data.bookingId || 'N/A';
		const flightDetails = data.flightDetails || '';
		const passengerName = data.passengerName || 'Quý khách';
		const checkInTime = data.checkInTime || 'N/A';
		const totalAmount = data.totalAmount || 0;
		const currency = data.currency || 'VND';
		
		// Check if flight details are actually available (not empty, null, or 'N/A')
		const hasFlightDetails = flightDetails && flightDetails !== 'N/A' && flightDetails.trim().length > 0;

		const subject = `Xác nhận đặt chỗ - Mã đặt chỗ: ${pnrCode}`;
		const htmlBody = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
		.content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
		.info-box { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #007bff; }
		.step-box { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #17a2b8; }
		.step-number { display: inline-block; background-color: #17a2b8; color: white; width: 30px; height: 30px; border-radius: 50%; text-align: center; line-height: 30px; font-weight: bold; margin-right: 10px; }
		.warning-box { background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>✓ Xác nhận đặt chỗ thành công</h1>
		</div>
		<div class="content">
			<p>Xin chào <strong>${passengerName}</strong>,</p>
			<p>Đặt chỗ của bạn đã được tạo thành công. Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
			
			<div class="info-box">
				<h3 style="margin-top: 0; color: #007bff;">📌 Thông tin đặt chỗ</h3>
				<p><strong>Mã đặt chỗ (PNR):</strong> <span style="font-size: 18px; color: #007bff; font-weight: bold;">${pnrCode}</span></p>
				<p><strong>Mã booking:</strong> ${bookingId}</p>
				<p><strong>Tổng tiền:</strong> ${totalAmount.toLocaleString()} ${currency}</p>
			</div>

			<div class="warning-box">
				<strong>🔔 Các bước tiếp theo:</strong>
				<div style="margin-top: 15px;">
					<div class="step-box">
						<span class="step-number">1</span>
						<strong>Thanh toán</strong> - Vui lòng thanh toán trong vòng 15 phút để hoàn tất đặt chỗ
					</div>
					<div class="step-box">
						<span class="step-number">2</span>
						<strong>Nhận email xác nhận</strong> - Sau khi thanh toán, bạn sẽ nhận được email xác nhận thanh toán
					</div>
					<div class="step-box">
						<span class="step-number">3</span>
						<strong>Làm thủ tục check-in</strong> - Sử dụng mã đặt chỗ trên để làm thủ tục check-in
					</div>
					<div class="step-box">
						<span class="step-number">4</span>
						<strong>Nhận vé máy bay</strong> - Sau khi check-in, bạn sẽ nhận được vé máy bay qua email
					</div>
				</div>
			</div>

			${hasFlightDetails ? `
			<div class="info-box">
				<h3 style="margin-top: 0; color: #007bff;">✈️ Chi tiết chuyến bay</h3>
				<div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px;">
					${flightDetails.split('\n\n').map(detail => 
						`<div style="margin-bottom: 15px; padding: 10px; background-color: white; border-left: 3px solid #007bff; border-radius: 3px;">
							${detail.split('\n').map(line => `<p style="margin: 5px 0;">${line}</p>`).join('')}
						</div>`
					).join('')}
				</div>
			</div>
			` : ''}

			<div class="warning-box">
				<strong>⏰ Lưu ý làm thủ tục:</strong>
				<p style="margin: 10px 0 0 0; font-size: 14px;">
					Vui lòng có mặt tại sân bay trước giờ khởi hành ít nhất 24 giờ để làm thủ tục check-in. 
					Hãy lưu lại mã đặt chỗ <strong>${pnrCode}</strong> để sử dụng tại sân bay.
				</p>
			</div>

			<p style="font-size: 13px; color: #666;">
				Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email hoặc hotline của chúng tôi.
			</p>

			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
				<p>© 2025 Flight Booking System. All rights reserved.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const textBody = `Xác nhận đặt chỗ thành công

Mã đặt chỗ (PNR): ${pnrCode}
Mã booking: ${bookingId}
Tổng tiền: ${totalAmount.toLocaleString()} ${currency}

CÁC BƯỚC TIẾP THEO:
1. Thanh toán - Vui lòng thanh toán trong vòng 15 phút để hoàn tất đặt chỗ
2. Nhận email xác nhận - Sau khi thanh toán, bạn sẽ nhận được email xác nhận thanh toán
3. Làm thủ tục check-in - Sử dụng mã đặt chỗ để làm thủ tục check-in
4. Nhận vé máy bay - Sau khi check-in, bạn sẽ nhận được vé máy bay qua email

${hasFlightDetails ? `CHI TIẾT CHUYẾN BAY:
${flightDetails}` : `CHI TIẾT CHUYẾN BAY:
Thông tin chi tiết chuyến bay sẽ được gửi sau khi thanh toán`}

LƯU Ý:
Vui lòng có mặt tại sân bay trước giờ khởi hành ít nhất 24 giờ để làm thủ tục check-in.
Hãy lưu lại mã đặt chỗ ${pnrCode} để sử dụng tại sân bay.

Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!`;

		return { subject, htmlBody, textBody };
	}

	/**
	 * Render Ticket Confirmation template
	 * Detailed ticket information after successful ticket creation
	 */
	private renderTicketConfirmationTemplate(data: Record<string, any>): TemplateResult {
		const passengerName = data.passengerName || 'Quý khách';
		const ticketDetails = data.ticketDetails || [];
		const checkInTime = data.checkInTime || 'N/A';

		const subject = 'Vé máy bay của bạn đã được phát hành thành công';
		const htmlBody = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 700px; margin: 0 auto; padding: 20px; }
		.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
		.content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
		.ticket-box { background-color: white; padding: 25px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 5px solid #667eea; }
		.ticket-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0; }
		.ticket-number { font-size: 24px; font-weight: bold; color: #667eea; }
		.flight-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
		.info-section { background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
		.info-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
		.info-value { font-size: 16px; font-weight: bold; color: #333; }
		.route-section { text-align: center; margin: 20px 0; }
		.airport-code { font-size: 32px; font-weight: bold; color: #667eea; }
		.airport-name { font-size: 14px; color: #666; margin-top: 5px; }
		.arrow { font-size: 24px; color: #667eea; margin: 10px 0; }
		.seat-info { background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0; }
		.checkin-box { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 8px; }
		.checkin-time { font-size: 20px; font-weight: bold; color: #856404; text-align: center; }
		.footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
		.divider { height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 20px 0; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1 style="margin: 0;">✈️ Vé máy bay của bạn đã sẵn sàng</h1>
			<p style="margin: 10px 0 0 0; opacity: 0.9;">Chúc bạn có một chuyến bay tuyệt vời!</p>
		</div>
		<div class="content">
			<p>Xin chào <strong>${passengerName}</strong>,</p>
			<p>Vé máy bay của bạn đã được phát hành thành công. Dưới đây là thông tin chi tiết về chuyến bay của bạn:</p>
			
			${ticketDetails.map((ticket: any, index: number) => `
			<div class="ticket-box">
				<div class="ticket-header">
					<div>
						<div class="info-label">Mã vé</div>
						<div class="ticket-number">${ticket.ticketNumber || 'N/A'}</div>
					</div>
					<div style="text-align: right;">
						<div class="info-label">Hành khách</div>
						<div class="info-value">${ticket.passengerName || 'N/A'}</div>
					</div>
				</div>

				<div class="route-section">
					<div>
						<div class="airport-code">${ticket.originAirport || 'N/A'}</div>
						<div class="airport-name">${ticket.originAirportName || ''}</div>
						<div class="airport-name">${ticket.originCity || ''}</div>
					</div>
					<div class="arrow">→</div>
					<div>
						<div class="airport-code">${ticket.destinationAirport || 'N/A'}</div>
						<div class="airport-name">${ticket.destinationAirportName || ''}</div>
						<div class="airport-name">${ticket.destinationCity || ''}</div>
					</div>
				</div>

				<div class="flight-info">
					<div class="info-section">
						<div class="info-label">Số hiệu chuyến bay</div>
						<div class="info-value">${ticket.flightNumber || 'N/A'}</div>
					</div>
					<div class="info-section">
						<div class="info-label">Loại vé</div>
						<div class="info-value">${ticket.fareClassName || 'N/A'}</div>
					</div>
					<div class="info-section">
						<div class="info-label">Giờ khởi hành</div>
						<div class="info-value">${ticket.departureTime || 'N/A'}</div>
					</div>
					<div class="info-section">
						<div class="info-label">Giờ đến nơi</div>
						<div class="info-value">${ticket.arrivalTime || 'N/A'}</div>
					</div>
				</div>

				<div class="seat-info">
					<div style="display: flex; justify-content: space-between; align-items: center;">
						<div>
							<div class="info-label">Ghế ngồi</div>
							<div class="info-value" style="font-size: 24px;">${ticket.seatNumber || 'N/A'}</div>
						</div>
						<div style="text-align: right;">
							<div class="info-label">Hạng ghế</div>
							<div class="info-value">${ticket.cabinClass === 'economy' ? 'Phổ thông' : ticket.cabinClass === 'business' ? 'Thương gia' : ticket.cabinClass || 'N/A'}</div>
						</div>
					</div>
				</div>
			</div>
			${index < ticketDetails.length - 1 ? '<div class="divider"></div>' : ''}
			`).join('')}

			<div class="checkin-box">
				<div class="info-label" style="text-align: center; margin-bottom: 10px;">⏰ Lưu ý làm thủ tục</div>
				<p style="text-align: center; margin: 10px 0 0 0; color: #856404; font-size: 14px;">
					Vui lòng có mặt tại sân bay đúng giờ để làm thủ tục check-in. 
					Vui lòng có mặt trước giờ khởi hành ít nhất 24 giờ để làm thủ tục.
				</p>
			</div>

			<div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
				<h3 style="margin-top: 0; color: #667eea;">📋 Lưu ý quan trọng:</h3>
				<ul style="line-height: 1.8;">
					<li>Vui lòng mang theo giấy tờ tùy thân hợp lệ khi đến sân bay</li>
					<li>Kiểm tra lại thông tin hành lý ký gửi và hành lý xách tay</li>
					<li>Đến sân bay đúng giờ để tránh bị lỡ chuyến bay</li>
					<li>Lưu lại email này để tiện tra cứu thông tin</li>
				</ul>
			</div>

			<p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email hoặc hotline.</p>
			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
				<p>© 2025 Wanderlust Airways. All rights reserved.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const textBody = `Vé máy bay của bạn đã được phát hành thành công

Xin chào ${passengerName},

Vé máy bay của bạn đã được phát hành thành công. Dưới đây là thông tin chi tiết:

${ticketDetails.map((ticket: any) => `
Mã vé: ${ticket.ticketNumber || 'N/A'}
Hành khách: ${ticket.passengerName || 'N/A'}
Chuyến bay: ${ticket.flightNumber || 'N/A'}
Từ: ${ticket.originAirport || 'N/A'} (${ticket.originAirportName || ''}, ${ticket.originCity || ''})
Đến: ${ticket.destinationAirport || 'N/A'} (${ticket.destinationAirportName || ''}, ${ticket.destinationCity || ''})
Giờ khởi hành: ${ticket.departureTime || 'N/A'}
Giờ đến nơi: ${ticket.arrivalTime || 'N/A'}
Loại vé: ${ticket.fareClassName || 'N/A'}
Ghế ngồi: ${ticket.seatNumber || 'N/A'}
Hạng ghế: ${ticket.cabinClass === 'economy' ? 'Phổ thông' : ticket.cabinClass === 'business' ? 'Thương gia' : ticket.cabinClass || 'N/A'}
`).join('\n---\n')}

Vui lòng có mặt tại sân bay đúng giờ để làm thủ tục check-in.
Vui lòng có mặt trước giờ khởi hành ít nhất 24 giờ để làm thủ tục.

Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.`;

		return { subject, htmlBody, textBody };
	}

	/**
	 * Render OTP Cancellation template
	 */
	private renderOtpCancellationTemplate(data: Record<string, any>): TemplateResult {
		const otp = data.otp || 'N/A';
		const expiresIn = data.expiresIn || '15 minutes';

		const subject = 'Xác thực hủy vé - OTP Code';
		const htmlBody = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
		.content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
		.otp-box { background-color: white; border: 2px solid #dc3545; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
		.otp-code { font-size: 32px; font-weight: bold; color: #dc3545; letter-spacing: 5px; }
		.warning { color: #dc3545; font-weight: bold; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Xác thực hủy vé</h1>
		</div>
		<div class="content">
			<p>Xin chào,</p>
			<p>Bạn đang thực hiện thao tác hủy vé máy bay. Vui lòng sử dụng mã OTP sau để xác thực:</p>
			<div class="otp-box">
				<div class="otp-code">${otp}</div>
			</div>
			<p class="warning">⚠️ Mã OTP này có hiệu lực trong ${expiresIn}. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
			<p>Nếu bạn không thực hiện thao tác hủy vé này, vui lòng bỏ qua email này.</p>
			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const textBody = `Xác thực hủy vé\n\nMã OTP của bạn là: ${otp}\n\nMã này có hiệu lực trong ${expiresIn}. Vui lòng không chia sẻ mã này với bất kỳ ai.`;

		return { subject, htmlBody, textBody };
	}

	/**
	 * Render Booking Cancellation template with refund information
	 */
	private renderBookingCancellationTemplate(data: Record<string, any>): TemplateResult {
		const passengerName = data.passengerName || 'Quý khách';
		const pnrCode = data.pnrCode || 'N/A';
		const bookingId = data.bookingId || 'N/A';
		const totalAmount = data.totalAmount || 0;
		const refundAmount = data.refundAmount || 0;
		const cancellationFee = data.cancellationFee || 0;
		const currency = data.currency || 'VND';
		const flightDetails = data.flightDetails || 'N/A';

		const subject = `Xác nhận hủy vé - Mã đặt chỗ: ${pnrCode}`;
		const htmlBody = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
		.content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
		.info-box { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #dc3545; }
		.info-row { margin: 10px 0; display: flex; justify-content: space-between; }
		.label { font-weight: bold; color: #666; }
		.value { color: #333; }
		.refund-box { background-color: #d4edda; border: 2px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px; }
		.refund-amount { font-size: 24px; font-weight: bold; color: #28a745; text-align: center; margin: 10px 0; }
		.fee-box { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px; }
		.footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>✓ Đã hủy vé thành công</h1>
		</div>
		<div class="content">
			<p>Xin chào <strong>${passengerName}</strong>,</p>
			<p>Yêu cầu hủy vé của bạn đã được xử lý thành công. Dưới đây là thông tin chi tiết:</p>
			
			<div class="info-box">
				<div class="info-row">
					<span class="label">Mã đặt chỗ (PNR):</span>
					<span class="value"><strong>${pnrCode}</strong></span>
				</div>
				<div class="info-row">
					<span class="label">Mã booking:</span>
					<span class="value">${bookingId}</span>
				</div>
				<div class="info-row">
					<span class="label">Chi tiết chuyến bay:</span>
				</div>
				<div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin-top: 10px;">
					${flightDetails !== 'N/A' ? flightDetails.split('\n\n').map(detail => 
						`<div style="margin-bottom: 15px; padding: 10px; background-color: white; border-left: 3px solid #dc3545; border-radius: 3px;">
							${detail.split('\n').map(line => `<p style="margin: 5px 0;">${line}</p>`).join('')}
						</div>`
					).join('') : '<p>N/A</p>'}
				</div>
			</div>

			<div class="refund-box">
				<h3 style="margin-top: 0; text-align: center; color: #28a745;">💰 Thông tin hoàn tiền</h3>
				<div class="info-row">
					<span class="label">Tổng tiền đã thanh toán:</span>
					<span class="value">${totalAmount.toLocaleString('vi-VN')} ${currency}</span>
				</div>
				<div class="fee-box">
					<div class="info-row">
						<span class="label">Phí hủy vé:</span>
						<span class="value" style="color: #856404;">- ${cancellationFee.toLocaleString('vi-VN')} ${currency}</span>
					</div>
					<div class="info-row">
						<span class="label">Phí dịch vụ & thuế không hoàn:</span>
						<span class="value" style="color: #856404;">- ${(totalAmount - refundAmount - cancellationFee).toLocaleString('vi-VN')} ${currency}</span>
					</div>
				</div>
				<div class="refund-amount">
					Số tiền hoàn lại: ${refundAmount.toLocaleString('vi-VN')} ${currency}
				</div>
				<p style="text-align: center; margin: 15px 0 0 0; color: #155724; font-size: 14px;">
					💰 Số tiền hoàn lại sẽ được chuyển về tài khoản thanh toán của bạn trong vòng 5-7 ngày làm việc.
				</p>
			</div>

			<div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
				<h3 style="margin-top: 0; color: #dc3545;">📋 Lưu ý:</h3>
				<ul style="line-height: 1.8;">
					<li>Vé đã được hủy thành công và không thể khôi phục</li>
					<li>Số tiền hoàn lại sẽ được chuyển về tài khoản thanh toán ban đầu</li>
					<li>Thời gian xử lý hoàn tiền: 5-7 ngày làm việc</li>
					<li>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi</li>
				</ul>
			</div>

			<p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi. Chúng tôi hy vọng được phục vụ bạn trong các chuyến bay tiếp theo.</p>
			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
				<p>© 2025 Wanderlust Airways. All rights reserved.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const textBody = `Đã hủy vé thành công

Xin chào ${passengerName},

Yêu cầu hủy vé của bạn đã được xử lý thành công.

Mã đặt chỗ (PNR): ${pnrCode}
Mã booking: ${bookingId}

Chi tiết chuyến bay:
${flightDetails}

Thông tin hoàn tiền:
Tổng tiền đã thanh toán: ${totalAmount.toLocaleString('vi-VN')} ${currency}
Phí hủy vé: - ${cancellationFee.toLocaleString('vi-VN')} ${currency}
Phí dịch vụ & thuế không hoàn: - ${(totalAmount - refundAmount - cancellationFee).toLocaleString('vi-VN')} ${currency}
─────────────────────────────
Số tiền hoàn lại: ${refundAmount.toLocaleString('vi-VN')} ${currency}

💰 Số tiền hoàn lại sẽ được chuyển về tài khoản thanh toán của bạn trong vòng 5-7 ngày làm việc.

Lưu ý:
- Vé đã được hủy thành công và không thể khôi phục
- Số tiền hoàn lại sẽ được chuyển về tài khoản thanh toán ban đầu
- Thời gian xử lý hoàn tiền: 5-7 ngày làm việc

Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.`;

		return { subject, htmlBody, textBody };
	}
}

