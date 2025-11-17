import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { RESERVATION_MS } from './reservation.messages';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';

@Controller()
export class ReservationMsController {
	private readonly logger = new Logger(ReservationMsController.name);

	constructor(private readonly reservationService: ReservationService) {}

	@MessagePattern(RESERVATION_MS.PATTERN.CREATE_RESERVATION)
	async handleCreateReservation(payload: {
		userId: string | null;
		dto: CreateReservationDto;
	}): Promise<ReservationResponseDto> {
		try {
			this.logger.log(
				`Create reservation: ${payload.dto.flightInstanceId} - ${payload.dto.fareClassCode}`,
			);
			const result = await this.reservationService.createReservation(payload.userId, payload.dto);
			this.logger.log(`Reservation created: ${result.reservationId} (Code: ${result.reservationCode})`);
			return result;
		} catch (error: any) {
			this.logger.error('Create reservation error:', error);
			throw error;
		}
	}

	@MessagePattern(RESERVATION_MS.PATTERN.GET_RESERVATION)
	async handleGetReservation(reservationIdOrCode: string): Promise<ReservationResponseDto> {
		try {
			this.logger.log(`Get reservation: ${reservationIdOrCode}`);
			const result = await this.reservationService.getReservation(reservationIdOrCode);
			return result;
		} catch (error: any) {
			this.logger.error('Get reservation error:', error);
			throw error;
		}
	}

	@MessagePattern(RESERVATION_MS.PATTERN.CANCEL_RESERVATION)
	async handleCancelReservation(reservationId: string): Promise<{ success: boolean; message: string }> {
		try {
			this.logger.log(`Cancel reservation: ${reservationId}`);
			const result = await this.reservationService.cancelReservation(reservationId);
			return result;
		} catch (error: any) {
			this.logger.error('Cancel reservation error:', error);
			throw error;
		}
	}
}

