import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpException,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
    Req,
    ServiceUnavailableException,
    UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiHeader,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { RESERVATION_MS } from 'src/microservices/reservation/reservation.messages';
import { COMMON_MESSAGES, RESERVATION_MESSAGES } from 'src/shared/constants/messages';
import { ParseUUIDv7Pipe } from 'src/shared/pipes/parse-uuid-v7.pipe';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import type { SeatAvailabilityService } from '../realtime/services/seat-availability.service';
import type { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';

@ApiTags('reservations')
@Controller('reservations')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth('access-token')
export class ReservationController {
    private readonly logger = new Logger(ReservationController.name);

    constructor(
        @Inject('RESERVATION_CLIENT') private readonly _client: ClientProxy,
        private readonly seatAvailabilityService: SeatAvailabilityService
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Create a new reservation',
        description:
            'Create a reservation to temporarily hold seats. Supports multi-segment for round-trip bookings. Backend stores segments array in Redis. Reservation expires after 15 minutes (configurable). Supports both authenticated users and guest users (via X-Session-Id header).',
    })
    @ApiHeader({
        name: 'X-Session-Id',
        description: 'Session ID for guest users (optional, required if not authenticated)',
        required: false,
    })
    @ApiOkResponse({
        description: 'Reservation created successfully',
        type: ReservationResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request parameters, flight not found, or not enough seats',
    })
    async createReservation(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Headers('x-session-id') sessionIdHeader: string | undefined,
        @Body() dto: CreateReservationDto
    ): Promise<ReservationResponseDto> {
        try {
            // Extract userId from JWT token (if authenticated) or use sessionId for guest users
            const userId = req.user?.userId || null;
            const isGuest = !userId;

            // For guest users, sessionId is required
            if (isGuest && !sessionIdHeader) {
                throw new BadRequestException(
                    RESERVATION_MESSAGES.VALIDATION.SESSION_ID_REQUIRED_FOR_GUEST
                );
            }

            // Send userId (null for guests) and sessionId to microservice
            const reservation = await firstValueFrom(
                this.client.send<ReservationResponseDto>(
                    RESERVATION_MS.PATTERN.CREATE_RESERVATION,
                    {
                        userId, // null for guest users
                        sessionId: isGuest ? sessionIdHeader : undefined, // sessionId for guest users
                        dto,
                    }
                )
            );

            // Publish seat availability changes to WebSocket clients (real-time updates)
            // When seats are reserved, notify all clients viewing the same flight
            try {
                for (const segment of reservation.segments) {
                    if (segment.flightSeatId && segment.seatNumber) {
                        await this.seatAvailabilityService.publishSeatChange(
                            segment.flightInstanceId,
                            [
                                {
                                    flightSeatId: segment.flightSeatId,
                                    seatNumber: segment.seatNumber,
                                    status: 'reserved',
                                    changedBy: userId || sessionIdHeader || 'guest',
                                },
                            ]
                        );
                    }
                }
            } catch (error) {
                // Log error but don't fail the request - WebSocket is best effort
                this.logger.warn(`Failed to publish seat availability changes: ${error.message}`);
            }

            return reservation;
        } catch (error: any) {
            // BEST PRACTICE: Re-throw HttpException instances first (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // BEST PRACTICE: Handle NestJS exceptions from microservices (they have statusCode and message)
            // When exceptions are serialized over TCP, they may have statusCode and response properties
            if (error?.statusCode && error?.message) {
                // Map status codes to appropriate HTTP exceptions, preserving the message
                const message = error.message;
                if (error.statusCode === 400) {
                    throw new BadRequestException(message);
                }
                if (error.statusCode === 404) {
                    throw new NotFoundException(message);
                }
                // Re-throw other status codes as-is (they're already HttpException-like)
                throw error;
            }

            // BEST PRACTICE: Handle error response object from microservice
            // Some microservices return { status: 'error', message: '...' } format
            if (error?.response?.message) {
                const message = error.response.message;
                const statusCode = error.response.statusCode || error.statusCode || 400;
                if (statusCode === 400) {
                    throw new BadRequestException(message);
                }
                if (statusCode === 404) {
                    throw new NotFoundException(message);
                }
                throw new BadRequestException(message);
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            // Connection refused - microservice is not running
            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED
                );
            }

            // Connection reset - microservice closed connection unexpectedly (ECONNRESET)
            if (
                errorCode === 'ECONNRESET' ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('read ECONNRESET')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }

            // Connection closed - microservice disconnected
            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }

            // Timeout errors - microservice not responding
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT
                );
            }

            // Handle microservice error format: { status: 'error', message: '...' }
            if (error?.status === 'error' && error?.message) {
                throw new BadRequestException(error.message);
            }

            // Handle RpcException - NestJS microservice exceptions
            // RpcException wraps the error with response property
            if (error?.response && typeof error.response === 'object') {
                const message = error.response.message || error.message || '';
                const statusCode = error.response.statusCode || error.status || 400;
                if (statusCode === 400) {
                    throw new BadRequestException(message);
                }
                if (statusCode === 404) {
                    throw new NotFoundException(message);
                }
                throw new BadRequestException(message);
            }

            // Try to extract message from various error formats
            // Microservice exceptions can be serialized in different ways
            let extractedMessage: string | null = null;

            // Try error.message (direct)
            if (
                error?.message &&
                typeof error.message === 'string' &&
                error.message !== 'Internal server error'
            ) {
                extractedMessage = error.message;
            }
            // Try error.response (nested)
            else if (error?.response && typeof error.response === 'string') {
                extractedMessage = error.response;
            }
            // Try error.toString() if it contains useful info
            else if (error?.toString && !error.toString().includes('[object Object]')) {
                const str = error.toString();
                if (str.length > 0 && str !== '[object Object]') {
                    extractedMessage = str;
                }
            }

            // Use extracted message or provide descriptive default
            const finalMessage = extractedMessage || COMMON_MESSAGES.ERROR.OPERATION_FAILED;
            throw new BadRequestException(finalMessage);
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get reservation by ID',
        description:
            'Get reservation details by reservation ID. Returns reservation information including expiration time.',
    })
    @ApiParam({
        name: 'id',
        description: 'Reservation ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'Reservation retrieved successfully',
        type: ReservationResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Reservation not found or expired',
    })
    async getReservation(
        @Param('id', ParseUUIDv7Pipe) reservationId: string
    ): Promise<ReservationResponseDto> {
        try {
            return await firstValueFrom(
                this.client.send<ReservationResponseDto>(
                    RESERVATION_MS.PATTERN.GET_RESERVATION,
                    reservationId
                )
            );
        } catch (error: any) {
            // Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                throw error;
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED
                );
            }

            // Connection reset - microservice closed connection unexpectedly (ECONNRESET)
            if (
                errorCode === 'ECONNRESET' ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('read ECONNRESET')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }

            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT
                );
            }

            if (error?.status === 'error' && error?.message) {
                throw new BadRequestException(
                    `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`
                );
            }
            throw new BadRequestException(
                `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`
            );
        }
    }

    @Get('code/:code')
    @ApiOperation({
        summary: 'Get reservation by code',
        description: 'Get reservation details by reservation code (6 alphanumeric characters).',
    })
    @ApiParam({
        name: 'code',
        description: 'Reservation code (6 alphanumeric characters)',
        example: 'ABC123',
    })
    @ApiOkResponse({
        description: 'Reservation retrieved successfully',
        type: ReservationResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Reservation code not found or expired',
    })
    async getReservationByCode(
        @Param('code') reservationCode: string
    ): Promise<ReservationResponseDto> {
        // Validate reservation code format BEFORE calling microservice
        // Reservation code should be 6 alphanumeric characters
        const codeRegex = /^[A-Z0-9]{6}$/i;
        if (!codeRegex.test(reservationCode)) {
            throw new BadRequestException(
                RESERVATION_MESSAGES.VALIDATION.RESERVATION_CODE_INVALID_FORMAT
            );
        }

        try {
            // Send reservation code to microservice - it will auto-detect if it's a code (6 chars) or ID (UUID)
            return await firstValueFrom(
                this.client.send<ReservationResponseDto>(
                    RESERVATION_MS.PATTERN.GET_RESERVATION,
                    reservationCode
                )
            );
        } catch (error: any) {
            // Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                throw error;
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED
                );
            }

            // Connection reset - microservice closed connection unexpectedly (ECONNRESET)
            if (
                errorCode === 'ECONNRESET' ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('read ECONNRESET')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }

            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT
                );
            }

            if (error?.status === 'error' && error?.message) {
                throw new BadRequestException(
                    `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`
                );
            }
            throw new BadRequestException(
                `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`
            );
        }
    }

    @Post(':id/cancel')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Cancel reservation',
        description: 'Cancel an active reservation. This will release the held seats.',
    })
    @ApiParam({
        name: 'id',
        description: 'Reservation ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'Reservation cancelled successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Reservation cancelled successfully' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Reservation not found, expired, or already cancelled',
    })
    async cancelReservation(
        @Param('id', ParseUUIDv7Pipe) reservationId: string
    ): Promise<{ success: boolean; message: string }> {
        try {
            // Get reservation before canceling to publish seat release events
            let reservation: ReservationResponseDto | null = null;
            try {
                reservation = await firstValueFrom(
                    this.client.send<ReservationResponseDto>(
                        RESERVATION_MS.PATTERN.GET_RESERVATION,
                        reservationId
                    )
                );
            } catch (error) {
                // If reservation not found, still proceed with cancel (might be already cancelled)
                this.logger.warn(
                    `Could not fetch reservation ${reservationId} before cancel: ${error.message}`
                );
            }

            const result = await firstValueFrom(
                this.client.send<{ success: boolean; message: string }>(
                    RESERVATION_MS.PATTERN.CANCEL_RESERVATION,
                    reservationId
                )
            );

            // Publish seat availability changes to WebSocket clients (real-time updates)
            // When reservation is cancelled, release any reserved seats
            if (reservation && result.success) {
                try {
                    for (const segment of reservation.segments) {
                        if (segment.flightSeatId && segment.seatNumber) {
                            await this.seatAvailabilityService.publishSeatChange(
                                segment.flightInstanceId,
                                [
                                    {
                                        flightSeatId: segment.flightSeatId,
                                        seatNumber: segment.seatNumber,
                                        status: 'available',
                                        changedBy: 'system',
                                    },
                                ]
                            );
                        }
                    }
                } catch (error) {
                    // Log error but don't fail the request - WebSocket is best effort
                    this.logger.warn(
                        `Failed to publish seat availability changes on cancel: ${error.message}`
                    );
                }
            }

            return result;
        } catch (error: any) {
            // Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                throw error;
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED
                );
            }

            // Connection reset - microservice closed connection unexpectedly (ECONNRESET)
            if (
                errorCode === 'ECONNRESET' ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('read ECONNRESET')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }

            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT
                );
            }

            if (error?.status === 'error' && error?.message) {
                throw new BadRequestException(
                    `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`
                );
            }
            throw new BadRequestException(
                `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`
            );
        }
    }

    @Get()
    @ApiOperation({
        summary: 'List all active reservations for the current user',
        description: 'Get a list of all active reservations belonging to the authenticated user.',
    })
    @ApiOkResponse({
        description: 'List of reservations retrieved successfully',
        type: [ReservationResponseDto],
    })
    async listReservations(
        @Req() req: Request & { user: { userId: string; email: string } }
    ): Promise<ReservationResponseDto[]> {
        try {
            // BEST PRACTICE: Extract userId from JWT token (validated by JwtAuthGuard)
            const userId = req.user.userId;

            // Send userId to microservice (NOT JWT token) - Best Practice: Option 2
            return await firstValueFrom(
                this.client.send<ReservationResponseDto[]>(
                    RESERVATION_MS.PATTERN.LIST_RESERVATIONS,
                    userId
                ) // ✅ Send userId, NOT token
            );
        } catch (error: any) {
            // Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                throw error;
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED
                );
            }

            // Connection reset - microservice closed connection unexpectedly (ECONNRESET)
            if (
                errorCode === 'ECONNRESET' ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('read ECONNRESET')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }

            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT
                );
            }

            if (error?.status === 'error' && error?.message) {
                throw new BadRequestException(
                    `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`
                );
            }
            throw new BadRequestException(
                `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`
            );
        }
    }

    @Post(':id/extend')
    @ApiOperation({
        summary: 'Extend reservation expiration time',
        description:
            'Extend the expiration time of an active reservation by a specified number of seconds.',
    })
    @ApiParam({
        name: 'id',
        description: 'Reservation ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'Reservation extended successfully',
        type: ReservationResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Reservation not found, expired, or invalid extension time',
    })
    async extendReservation(
        @Param('id', ParseUUIDv7Pipe) reservationId: string,
        @Body() body: { additionalSeconds: number }
    ): Promise<ReservationResponseDto> {
        try {
            // Validate additionalSeconds
            if (!body.additionalSeconds || body.additionalSeconds <= 0) {
                throw new BadRequestException(
                    RESERVATION_MESSAGES.VALIDATION.ADDITIONAL_SECONDS_INVALID
                );
            }

            return await firstValueFrom(
                this.client.send<ReservationResponseDto>(
                    RESERVATION_MS.PATTERN.EXTEND_RESERVATION,
                    {
                        reservationId,
                        additionalSeconds: body.additionalSeconds,
                    }
                )
            );
        } catch (error: any) {
            // Re-throw HttpException instances (BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Also check for statusCode property for compatibility
            if (error?.statusCode && error?.message) {
                throw error;
            }

            // Handle microservice connection errors - these are infrastructure issues (503)
            const errorMessage = error?.message || error?.toString() || '';
            const errorCode = error?.code || '';

            if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_REFUSED
                );
            }

            // Connection reset - microservice closed connection unexpectedly (ECONNRESET)
            if (
                errorCode === 'ECONNRESET' ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('read ECONNRESET')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }

            if (errorMessage.includes('Connection closed')) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_CONNECTION_CLOSED
                );
            }
            if (
                errorCode === 'ETIMEDOUT' ||
                errorMessage.includes('timeout') ||
                errorMessage.includes('ETIMEDOUT')
            ) {
                throw new ServiceUnavailableException(
                    COMMON_MESSAGES.ERROR.MICROSERVICE_REQUEST_TIMEOUT
                );
            }

            if (error?.status === 'error' && error?.message) {
                throw new BadRequestException(
                    `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error.message}`
                );
            }
            throw new BadRequestException(
                `${COMMON_MESSAGES.ERROR.OPERATION_FAILED}: ${error?.message || COMMON_MESSAGES.ERROR.UNKNOWN_ERROR}`
            );
        }
    }
}
