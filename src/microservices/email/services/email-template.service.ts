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
			case EmailTemplate.PAYMENT_SUCCESS:
				return this.renderPaymentSuccessTemplate(data);
			case EmailTemplate.PAYMENT_FAILED:
				return this.renderPaymentFailedTemplate(data);
			case EmailTemplate.BOOKING_CONFIRMATION:
				return this.renderBookingConfirmationTemplate(data);
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
			</div>
			<p>Thông tin chi tiết về chuyến bay đã được gửi kèm theo email này. Vui lòng kiểm tra email và lưu lại mã đặt chỗ để sử dụng tại sân bay.</p>
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

		const textBody = `Thanh toán thành công\n\nMã đặt chỗ (PNR): ${pnrCode}\nMã booking: ${bookingId}\nTổng tiền: ${totalAmount.toLocaleString()} ${currency}\n\nCảm ơn bạn đã sử dụng dịch vụ của chúng tôi.`;

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
	 */
	private renderBookingConfirmationTemplate(data: Record<string, any>): TemplateResult {
		const pnrCode = data.pnrCode || 'N/A';
		const bookingId = data.bookingId || 'N/A';
		const flightDetails = data.flightDetails || 'N/A';
		const passengerName = data.passengerName || 'Quý khách';

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
		.footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>✓ Xác nhận đặt chỗ</h1>
		</div>
		<div class="content">
			<p>Xin chào <strong>${passengerName}</strong>,</p>
			<p>Đặt chỗ của bạn đã được xác nhận thành công.</p>
			<div class="info-box">
				<p><strong>Mã đặt chỗ (PNR):</strong> ${pnrCode}</p>
				<p><strong>Mã booking:</strong> ${bookingId}</p>
				<p><strong>Chi tiết chuyến bay:</strong></p>
				<pre style="white-space: pre-wrap;">${flightDetails}</pre>
			</div>
			<p>Vui lòng thanh toán trong vòng 15 phút để hoàn tất đặt chỗ. Sau khi thanh toán thành công, bạn sẽ nhận được email xác nhận kèm theo vé điện tử.</p>
			<div class="footer">
				<p>Đây là email tự động, vui lòng không trả lời email này.</p>
			</div>
		</div>
	</div>
</body>
</html>
		`;

		const textBody = `Xác nhận đặt chỗ\n\nMã đặt chỗ (PNR): ${pnrCode}\nMã booking: ${bookingId}\n\nChi tiết chuyến bay:\n${flightDetails}\n\nVui lòng thanh toán trong vòng 15 phút để hoàn tất đặt chỗ.`;

		return { subject, htmlBody, textBody };
	}
}

