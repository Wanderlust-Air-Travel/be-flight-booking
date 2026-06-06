import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Logger,
    NotFoundException,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiHeader,
    ApiInternalServerErrorResponse,
    ApiNoContentResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { FareClass } from 'src/shared/entities/fare/fare-class.entity';
import { FlightInstance } from 'src/shared/entities/flight/flight-instance.entity';
import { FlightSeat } from 'src/shared/entities/flight/flight-seat.entity';
import {
    BookingStateException,
    BookingStateNotFoundException,
    BookingStateStorageException,
    CabinNotSelectedException,
} from 'src/shared/exceptions/booking-state.exceptions';
import { ParseUUIDv7Pipe } from 'src/shared/pipes/parse-uuid-v7.pipe';
import { BookingStateService } from 'src/shared/services/booking-state.service';
import { generateSessionId } from 'src/shared/utils/session-helper';
import type { Repository } from 'typeorm';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { AllBookingStatesResponseDto } from './dto/all-booking-states-response.dto';
import { BookingStateResponseDto } from './dto/booking-state-response.dto';
import type { SaveCabinSelectionDto } from './dto/save-cabin-selection.dto';
import type { SaveCabinServicesDto } from './dto/save-cabin-services.dto';
import type { SaveSeatSelectionDto } from './dto/save-seat-selection.dto';

@ApiTags('booking-state')
@Controller('booking-state')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth('access-token')
export class BookingStateController {
    private readonly logger = new Logger(BookingStateController.name);

    private get flightSeatRepo(): Repository<FlightSeat> {
        return this._flightSeatRepo;
    }

    private get flightInstanceRepo(): Repository<FlightInstance> {
        return this._flightInstanceRepo;
    }

    private get fareClassRepo(): Repository<FareClass> {
        return this._fareClassRepo;
    }

    constructor(
        private readonly bookingStateService: BookingStateService,
        @InjectRepository(FlightSeat) private readonly _flightSeatRepo: Repository<FlightSeat>,
        @InjectRepository(FlightInstance)
        private readonly _flightInstanceRepo: Repository<FlightInstance>,
        @InjectRepository(FareClass) private readonly _fareClassRepo: Repository<FareClass>
    ) {}

    @Post('cabin')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Save cabin selection',
        description:
            'Save cabin selection (cabin type and fare class) to Redis. This must be done before selecting a seat. State expires after 30 minutes. Supports both authenticated users and guest users (via X-Session-Id header).',
    })
    @ApiHeader({
        name: 'X-Session-Id',
        description: 'Session ID for guest users (optional, required if not authenticated)',
        required: false,
    })
    @ApiOkResponse({
        description: 'Cabin selection saved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Cabin selection saved successfully' },
                sessionId: {
                    type: 'string',
                    example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
                    description: 'Session ID (only for guest users)',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid request parameters',
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to save cabin selection to Redis',
    })
    async saveCabinSelection(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Headers('x-session-id') sessionIdHeader: string | undefined,
        @Body() dto: SaveCabinSelectionDto
    ): Promise<{ success: boolean; message: string; sessionId?: string }> {
        const userId = req.user?.userId || null;
        const isGuest = !userId;

        // For guest users, get or generate session ID
        let sessionId: string | null = null;
        if (isGuest) {
            sessionId = sessionIdHeader || generateSessionId();
        }

        const identifier = userId || sessionId!;

        try {
            const result = await this.bookingStateService.saveCabinSelection(
                identifier,
                dto,
                isGuest
            );

            // Return sessionId for guest users so frontend can use it in subsequent requests
            if (isGuest) {
                return { ...result, sessionId: sessionId! };
            }

            return result;
        } catch (error) {
            // Re-throw custom exceptions as-is
            if (error instanceof BookingStateException) {
                throw error;
            }
            // Wrap unexpected errors
            throw new BookingStateStorageException(
                'save cabin selection',
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    @Post('seat')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Save seat selection',
        description:
            'Save seat selection to Redis. Cabin must be selected first. State expires after 30 minutes. Supports both authenticated users and guest users (via X-Session-Id header).',
    })
    @ApiHeader({
        name: 'X-Session-Id',
        description: 'Session ID for guest users (optional, required if not authenticated)',
        required: false,
    })
    @ApiOkResponse({
        description: 'Seat selection saved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Seat selection saved successfully' },
                sessionId: {
                    type: 'string',
                    example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
                    description: 'Session ID (only for guest users)',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid request parameters or cabin not selected',
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to save seat selection to Redis',
    })
    async saveSeatSelection(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Headers('x-session-id') sessionIdHeader: string | undefined,
        @Body() dto: SaveSeatSelectionDto
    ): Promise<{ success: boolean; message: string; sessionId?: string }> {
        const userId = req.user?.userId || null;
        const sessionId = sessionIdHeader || null;

        // Log for debugging
        this.logger.log(
            `[saveSeatSelection] userId: ${userId}, sessionId: ${sessionId}, flightInstanceId: ${dto.flightInstanceId}`
        );

        // BEST PRACTICE: Try to find booking state with both userId and sessionId
        // This handles cases where JWT token expires between cabin and seat selection
        // Priority: userId (authenticated) > sessionId (guest)
        let identifier: string;
        let isGuest: boolean;
        let fallbackIdentifier: string | undefined;
        let fallbackIsGuest: boolean | undefined;

        if (userId) {
            // User is authenticated - try with userId first
            identifier = userId;
            isGuest = false;

            // If have sessionId, use it as fallback
            if (sessionId) {
                fallbackIdentifier = sessionId;
                fallbackIsGuest = true;
                this.logger.log(
                    `[saveSeatSelection] Authenticated user with sessionId fallback: ${sessionId}`
                );
            }
        } else {
            // User is guest - sessionId is required
            if (!sessionId) {
                this.logger.error(
                    `[saveSeatSelection] Guest user without sessionId for flight ${dto.flightInstanceId}`
                );
                throw new BadRequestException(
                    'X-Session-Id header is required for guest users. Please provide the session ID from the cabin selection response.'
                );
            }
            identifier = sessionId;
            isGuest = true;
            this.logger.log(`[saveSeatSelection] Guest user with sessionId: ${sessionId}`);
        }

        try {
            // BEST PRACTICE: Validate seats before saving to booking state
            // This provides early validation feedback to users
            // Pass fallback identifier to try both userId and sessionId if needed
            await this.validateSeatSelection(
                dto,
                identifier,
                isGuest,
                fallbackIdentifier,
                fallbackIsGuest
            );

            // Prepare seat selection data: prefer seats array, fallback to single seat for backward compatibility
            let seatSelection: any = null;
            let seats: any[] | null = null;

            if (dto.seats && dto.seats.length > 0) {
                // Use seats array (preferred for multiple passengers)
                seats = dto.seats;
                // Also create single seat for backward compatibility
                seatSelection = {
                    flightInstanceId: dto.flightInstanceId,
                    flightSeatId: dto.seats[0].flightSeatId,
                    seatNumber: dto.seats[0].seatNumber,
                };
            } else if (dto.seat) {
                // Use seat object
                seatSelection = {
                    flightInstanceId: dto.flightInstanceId,
                    flightSeatId: dto.seat.flightSeatId,
                    seatNumber: dto.seat.seatNumber,
                };
                seats = [
                    {
                        flightSeatId: dto.seat.flightSeatId,
                        seatNumber: dto.seat.seatNumber,
                    },
                ];
            } else if (dto.flightSeatId && dto.seatNumber) {
                // Legacy fields for backward compatibility
                seatSelection = {
                    flightInstanceId: dto.flightInstanceId,
                    flightSeatId: dto.flightSeatId,
                    seatNumber: dto.seatNumber,
                };
                seats = [
                    {
                        flightSeatId: dto.flightSeatId,
                        seatNumber: dto.seatNumber,
                    },
                ];
            } else {
                throw new BadRequestException(
                    'Either seats array, seat object, or flightSeatId/seatNumber must be provided'
                );
            }

            const result = await this.bookingStateService.saveSeatSelection(
                identifier,
                seatSelection,
                seats,
                isGuest
            );

            // Return sessionId for guest users so frontend can use it in subsequent requests
            if (isGuest) {
                return { ...result, sessionId: sessionId! };
            }

            return result;
        } catch (error) {
            // Re-throw custom exceptions as-is (including validation errors)
            if (
                error instanceof BookingStateException ||
                error instanceof BadRequestException ||
                error instanceof NotFoundException
            ) {
                throw error;
            }
            // Wrap unexpected errors
            throw new BookingStateStorageException(
                'save seat selection',
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    /**
     * Validate seat selection before saving to booking state
     * Business logic: Ensures seat exists, is available, belongs to correct flight instance, and matches cabin class
     * Supports both single seat and multiple seats
     */
    private async validateSeatSelection(
        dto: SaveSeatSelectionDto,
        identifier: string,
        isGuest = false,
        fallbackIdentifier?: string,
        fallbackIsGuest?: boolean
    ): Promise<void> {
        // Determine which seats to validate: prefer seats array, fallback to single seat
        const seatsToValidate: Array<{ flightSeatId: string; seatNumber: string }> = [];

        if (dto.seats && dto.seats.length > 0) {
            seatsToValidate.push(...dto.seats);
        } else if (dto.seat) {
            seatsToValidate.push({
                flightSeatId: dto.seat.flightSeatId,
                seatNumber: dto.seat.seatNumber,
            });
        } else if (dto.flightSeatId && dto.seatNumber) {
            seatsToValidate.push({ flightSeatId: dto.flightSeatId, seatNumber: dto.seatNumber });
        } else {
            throw new BadRequestException(
                'Either seats array, seat object, or flightSeatId/seatNumber must be provided'
            );
        }

        if (seatsToValidate.length === 0) {
            throw new BadRequestException('At least one seat must be provided');
        }
        // 1. Get booking state to check cabin selection
        // Try with primary identifier first
        this.logger.log(
            `[validateSeatSelection] Trying with identifier: ${identifier}, isGuest: ${isGuest}, flightInstanceId: ${dto.flightInstanceId}`
        );
        let bookingState = await this.bookingStateService.getBookingState(
            identifier,
            dto.flightInstanceId,
            isGuest
        );

        // If not found and have fallback identifier, try with fallback
        // This handles cases where cabin was saved with different identifier (e.g., userId vs sessionId)
        if (
            (!bookingState || !bookingState.cabin) &&
            fallbackIdentifier &&
            fallbackIsGuest !== undefined
        ) {
            this.logger.log(
                `[validateSeatSelection] Not found with primary identifier, trying fallback: ${fallbackIdentifier}, isGuest: ${fallbackIsGuest}`
            );
            bookingState = await this.bookingStateService.getBookingState(
                fallbackIdentifier,
                dto.flightInstanceId,
                fallbackIsGuest
            );
        }

        if (!bookingState || !bookingState.cabin) {
            this.logger.error(
                `[validateSeatSelection] Cabin not found for identifier: ${identifier}, isGuest: ${isGuest}, flightInstanceId: ${dto.flightInstanceId}, fallback: ${fallbackIdentifier}`
            );
            throw new CabinNotSelectedException(dto.flightInstanceId);
        }

        this.logger.log(
            `[validateSeatSelection] Found cabin selection: ${bookingState.cabin.cabinType}, fareClass: ${bookingState.cabin.fareClassCode}`
        );

        // 2. Validate flight instance exists
        const flightInstance = await this.flightInstanceRepo.findOne({
            where: { flight_instance_id: dto.flightInstanceId },
        });
        if (!flightInstance) {
            throw new NotFoundException(`Flight instance ${dto.flightInstanceId} not found`);
        }

        // 3. Get fare class to determine expected cabin class (used for all seats)
        const fareClass = await this.fareClassRepo.findOne({
            where: { fare_class_code: bookingState.cabin.fareClassCode },
            relations: ['cabin_class'],
        });

        if (!fareClass) {
            throw new BadRequestException(
                `Fare class ${bookingState.cabin.fareClassCode} not found`
            );
        }

        const expectedCabinClassCode = fareClass.cabin_class.cabin_class_code;

        // 4. Validate all seats in the array
        const validatedSeats: Array<{ flightSeatId: string; seatNumber: string; flightSeat: any }> =
            [];
        const seatIds = new Set<string>(); // Track duplicate seat IDs

        for (const seatItem of seatsToValidate) {
            // Check for duplicate seats
            if (seatIds.has(seatItem.flightSeatId)) {
                throw new BadRequestException(
                    `Duplicate seat ${seatItem.seatNumber} (${seatItem.flightSeatId}) in selection. Each passenger must have a unique seat.`
                );
            }
            seatIds.add(seatItem.flightSeatId);

            // Validate seat exists and load relations
            const flightSeat = await this.flightSeatRepo.findOne({
                where: { flight_seat_id: seatItem.flightSeatId },
                relations: ['seat_config', 'seat_config.cabin_class', 'flight_instance'],
            });

            if (!flightSeat) {
                throw new BadRequestException(
                    `Seat ${seatItem.flightSeatId} not found. Please select a valid seat.`
                );
            }

            // Validate seat belongs to the correct flight instance
            if (flightSeat.flight_instance_id !== dto.flightInstanceId) {
                throw new BadRequestException(
                    `Seat ${seatItem.seatNumber} (${seatItem.flightSeatId}) does not belong to flight instance ${dto.flightInstanceId}. Please select a seat from the correct flight.`
                );
            }

            // Validate seat number matches
            if (flightSeat.seat_number !== seatItem.seatNumber) {
                throw new BadRequestException(
                    `Seat number mismatch. Expected ${flightSeat.seat_number} for seat ${seatItem.flightSeatId}, but received ${seatItem.seatNumber}.`
                );
            }

            // Validate seat is available
            if (!flightSeat.is_available) {
                throw new BadRequestException(
                    `Seat ${seatItem.seatNumber} is not available. Please select another seat.`
                );
            }

            // Validate seat matches cabin class from booking state
            const actualCabinClassCode = flightSeat.seat_config.cabin_class.cabin_class_code;

            if (actualCabinClassCode !== expectedCabinClassCode) {
                throw new BadRequestException(
                    `Seat ${seatItem.seatNumber} is in ${actualCabinClassCode === 'Y' ? 'Economy' : 'Business'} class, but you selected ${expectedCabinClassCode === 'Y' ? 'Economy' : 'Business'} class. Please select a seat from the correct cabin.`
                );
            }

            validatedSeats.push({
                flightSeatId: seatItem.flightSeatId,
                seatNumber: seatItem.seatNumber,
                flightSeat,
            });
        }

        this.logger.log(
            `[validateSeatSelection] Successfully validated ${validatedSeats.length} seat(s)`
        );
    }

    @Get()
    @ApiOperation({
        summary: 'Get all booking states',
        description:
            'Get all booking states (cabin and seat selections) for the authenticated user or guest session. Returns array of booking states with flightInstanceId. Useful for frontend to get flightInstanceId without storing in session.',
    })
    @ApiHeader({
        name: 'X-Session-Id',
        description: 'Session ID for guest users (optional, required if not authenticated)',
        required: false,
    })
    @ApiOkResponse({
        description: 'List of all booking states',
        type: AllBookingStatesResponseDto,
    })
    async getAllBookingStates(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Headers('x-session-id') sessionIdHeader: string | undefined
    ): Promise<AllBookingStatesResponseDto> {
        const userId = req.user?.userId || null;
        const isGuest = !userId;

        if (isGuest && !sessionIdHeader) {
            throw new BadRequestException('X-Session-Id header is required for guest users.');
        }

        const identifier = userId || sessionIdHeader!;
        const allStates = await this.bookingStateService.getAllBookingStates(identifier, isGuest);

        return {
            states: allStates.map(({ flightInstanceId, state }) => ({
                flightInstanceId,
                cabin: state.cabin,
                seat: state.seat,
                updatedAt: state.updatedAt,
            })),
        };
    }

    @Get(':flightInstanceId')
    @ApiOperation({
        summary: 'Get current booking state',
        description:
            'Get current booking state (cabin and seat selections) from Redis for a specific flight instance. Recommended to call before creating reservation to verify state. Supports both authenticated users and guest users (via X-Session-Id header).',
    })
    @ApiHeader({
        name: 'X-Session-Id',
        description: 'Session ID for guest users (optional, required if not authenticated)',
        required: false,
    })
    @ApiParam({
        name: 'flightInstanceId',
        description: 'Flight instance ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'Booking state retrieved successfully',
        type: BookingStateResponseDto,
    })
    @ApiNotFoundResponse({
        description: 'Booking state not found (expired or never created)',
    })
    async getBookingState(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Headers('x-session-id') sessionIdHeader: string | undefined,
        @Param('flightInstanceId', ParseUUIDv7Pipe) flightInstanceId: string
    ): Promise<BookingStateResponseDto> {
        const userId = req.user?.userId || null;
        const isGuest = !userId;

        if (isGuest && !sessionIdHeader) {
            throw new BadRequestException('X-Session-Id header is required for guest users.');
        }

        const identifier = userId || sessionIdHeader!;
        const state = await this.bookingStateService.getBookingState(
            identifier,
            flightInstanceId,
            isGuest
        );

        if (!state) {
            throw new BookingStateNotFoundException(flightInstanceId);
        }

        return state;
    }

    @Delete(':flightInstanceId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Clear booking state',
        description:
            'Clear booking state (cabin and seat selections) from Redis for a specific flight instance. Useful when user wants to start over or cancel the booking process. State is automatically cleared after successful reservation creation. Supports both authenticated users and guest users (via X-Session-Id header).',
    })
    @ApiHeader({
        name: 'X-Session-Id',
        description: 'Session ID for guest users (optional, required if not authenticated)',
        required: false,
    })
    @ApiParam({
        name: 'flightInstanceId',
        description: 'Flight instance ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiNoContentResponse({
        description: 'Booking state cleared successfully (or did not exist)',
    })
    @ApiNotFoundResponse({
        description: 'Booking state not found (already cleared or expired)',
    })
    async clearBookingState(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Headers('x-session-id') sessionIdHeader: string | undefined,
        @Param('flightInstanceId', ParseUUIDv7Pipe) flightInstanceId: string
    ): Promise<void> {
        const userId = req.user?.userId || null;
        const isGuest = !userId;

        if (isGuest && !sessionIdHeader) {
            throw new BadRequestException('X-Session-Id header is required for guest users.');
        }

        const identifier = userId || sessionIdHeader!;
        const deleted = await this.bookingStateService.clearBookingState(
            identifier,
            flightInstanceId,
            isGuest
        );

        // Return 204 No Content regardless of whether state existed or not (idempotent)
        // This follows REST best practice: DELETE is idempotent
        if (!deleted) {
            // State didn't exist, but we still return 204 (idempotent behavior)
            // This is acceptable as DELETE operations should be idempotent
        }
    }

    @Post('cabin-services')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Save selected cabin services',
        description:
            'Save selected cabin services (meals, WiFi, etc.) to Redis. Cabin must be selected first. State expires after 30 minutes. Supports both authenticated users and guest users (via X-Session-Id header).',
    })
    @ApiHeader({
        name: 'X-Session-Id',
        description: 'Session ID for guest users (optional, required if not authenticated)',
        required: false,
    })
    @ApiOkResponse({
        description: 'Cabin services saved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Cabin services saved successfully' },
                sessionId: {
                    type: 'string',
                    example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
                    description: 'Session ID (only for guest users)',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid request parameters or cabin not selected',
    })
    @ApiInternalServerErrorResponse({
        description: 'Failed to save cabin services to Redis',
    })
    async saveCabinServices(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Headers('x-session-id') sessionIdHeader: string | undefined,
        @Body() dto: SaveCabinServicesDto
    ): Promise<{ success: boolean; message: string; sessionId?: string }> {
        const userId = req.user?.userId || null;
        const isGuest = !userId;

        // For guest users, get or generate session ID
        let sessionId: string | null = null;
        if (isGuest) {
            sessionId = sessionIdHeader || generateSessionId();
        }

        const identifier = userId || sessionId!;

        try {
            // Transform DTO to SelectedCabinService[]
            const services = dto.services.map((s) => ({
                cabinServiceId: s.cabinServiceId,
                serviceType: s.serviceType,
                serviceName: s.serviceName,
                price: s.price,
                isIncluded: s.isIncluded,
            }));

            const result = await this.bookingStateService.saveCabinServices(
                identifier,
                dto.flightInstanceId,
                services,
                isGuest
            );

            // Return sessionId for guest users so frontend can use it in subsequent requests
            if (isGuest) {
                return { ...result, sessionId: sessionId! };
            }

            return result;
        } catch (error) {
            // Re-throw custom exceptions as-is
            if (error instanceof BookingStateException) {
                throw error;
            }
            // Wrap unexpected errors
            throw new BookingStateStorageException(
                'save cabin services',
                error instanceof Error ? error.message : String(error)
            );
        }
    }
}
