import {
    type ArgumentsHost,
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
    Logger,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiHeader,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { PAYMENT_MS } from 'src/microservices/payment/payment.messages';
import { PAYMENT_MESSAGES } from 'src/shared/constants/messages';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guard/optional-jwt-auth.guard';
import { PaymentStatusService } from '../realtime/services/payment-status.service';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import type { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
    private readonly logger = new Logger(PaymentController.name);

    constructor(
        @Inject('PAYMENT_CLIENT') private readonly client: ClientProxy,
        private readonly paymentStatusService: PaymentStatusService
    ) {}

    @Post('bookings/:bookingId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Create a new payment for a booking',
        description:
            'Create a new payment record for a booking. This creates a pending payment. To process the payment immediately, use the process endpoint. Requires JWT authentication. User ID is extracted from JWT token.',
    })
    @ApiParam({
        name: 'bookingId',
        description: 'Booking ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'Payment created successfully',
        type: PaymentResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request parameters, booking not found, or validation failed',
    })
    async createPayment(
        @Req() req: Request & { user: { userId: string; email: string } },
        @Param('bookingId') bookingId: string,
        @Body() dto: CreatePaymentDto
    ): Promise<PaymentResponseDto> {
        // Fallback: if NestJS injects the DTO class instead of an instance, read from req.body
        const body = typeof dto === 'function' ? req.body : dto;
        const userId = req.user.userId;

        return await firstValueFrom(
            this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.CREATE_PAYMENT, {
                userId,
                dto: { ...body, bookingId },
            })
        );
    }

    @Post('bookings/:bookingId/process')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Process payment for a booking',
        description:
            'Create and process a payment for a booking immediately. This will create a payment record and update the booking status to paid if successful. In production, this would integrate with a payment gateway. Supports both authenticated users and guest users.',
    })
    @ApiParam({
        name: 'bookingId',
        description: 'Booking ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'Payment processed successfully',
        type: PaymentResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request parameters, booking not found, or validation failed',
    })
    async processPayment(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Param('bookingId') bookingId: string,
        @Body() dto: CreatePaymentDto
    ): Promise<PaymentResponseDto> {
        const body = typeof dto === 'function' ? req.body : dto;
        const userId = req.user?.userId || null;

        const payment = await firstValueFrom(
            this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.PROCESS_PAYMENT, {
                userId,
                dto: { ...body, bookingId },
            })
        );

        // Publish payment status change to WebSocket clients (real-time updates)
        try {
            await this.paymentStatusService.publishPaymentStatusChange(
                payment.bookingId,
                payment.paymentId,
                payment.status,
                {
                    transactionRef: payment.transactionRef,
                    paymentMethodCode: payment.paymentMethodCode,
                }
            );
        } catch (error) {
            this.logger.warn(`Failed to publish payment status change: ${(error as Error).message}`);
        }

        return payment;
    }

    @Get(':id')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get payment by ID',
        description:
            'Get payment details by payment ID. Supports both authenticated users and guest users.',
    })
    @ApiParam({
        name: 'id',
        description: 'Payment ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'Payment retrieved successfully',
        type: PaymentResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Invalid payment ID or payment not found',
    })
    async getPayment(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Param('id') paymentId: string
    ): Promise<PaymentResponseDto> {
        const userId = req.user?.userId || null;

        return await firstValueFrom(
            this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.GET_PAYMENT, {
                userId,
                paymentId,
            })
        );
    }

    @Get('bookings/:bookingId')
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get all payments for a booking',
        description:
            'Get all payment records for a specific booking. Supports both authenticated users and guest users.',
    })
    @ApiParam({
        name: 'bookingId',
        description: 'Booking ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'List of payments retrieved successfully',
        type: [PaymentResponseDto],
    })
    @ApiBadRequestResponse({
        description: 'Invalid booking ID or booking not found',
    })
    async getPaymentsByBooking(
        @Req() req: Request & { user?: { userId: string; email: string } },
        @Param('bookingId') bookingId: string
    ): Promise<PaymentResponseDto[]> {
        const userId = req.user?.userId || null;

        return await firstValueFrom(
            this.client.send<PaymentResponseDto[]>(PAYMENT_MS.PATTERN.GET_PAYMENTS_BY_BOOKING, {
                userId,
                bookingId,
            })
        );
    }

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Update payment status',
        description:
            'Update the status of a payment. Typically used by payment gateway webhooks (with system token) or authenticated users updating their payment status. **Guest users cannot update payment status directly** - payment status is updated automatically via payment gateway webhooks.',
    })
    @ApiParam({
        name: 'id',
        description: 'Payment ID (UUID v7)',
        example: '019a8f4a-bb0e-7402-a0c4-27647b89dc71',
    })
    @ApiOkResponse({
        description: 'Payment status updated successfully',
        type: PaymentResponseDto,
    })
    @ApiBadRequestResponse({
        description: 'Invalid payment ID or request parameters',
    })
    @ApiUnauthorizedResponse({
        description: 'Unauthorized - JWT token required',
    })
    async updatePaymentStatus(
        @Req() req: Request & { user: { userId: string; email: string } },
        @Param('id') paymentId: string,
        @Body() dto: UpdatePaymentStatusDto
    ): Promise<PaymentResponseDto> {
        const body = typeof dto === 'function' ? req.body : dto;
        const userId = req.user.userId;

        return await firstValueFrom(
            this.client.send<PaymentResponseDto>(PAYMENT_MS.PATTERN.UPDATE_PAYMENT_STATUS, {
                userId,
                dto: { ...body, paymentId },
            })
        );
    }

    @Post('webhooks/:gateway')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Handle payment gateway webhook',
        description:
            'Webhook endpoint for payment gateways to notify payment status updates. This endpoint does not require JWT authentication as it is called by payment gateways. Currently only supports "dev" gateway for development/demo purposes.',
    })
    @ApiParam({
        name: 'gateway',
        description: 'Payment gateway name (currently only "dev" is supported)',
        example: 'dev',
    })
    @ApiHeader({
        name: 'x-signature',
        description: 'Webhook signature for verification',
        required: false,
    })
    @ApiOkResponse({
        description: 'Webhook processed successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Webhook processed successfully' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid webhook signature or payload',
    })
    async handleWebhook(
        @Param('gateway') gateway: string,
        @Headers('x-signature') signature: string,
        @Body() payload: unknown
    ): Promise<{ success: boolean; message: string }> {
        const validGateways = ['dev', 'mock'];
        if (!validGateways.includes(gateway.toLowerCase())) {
            throw new BadRequestException(
                `${PAYMENT_MESSAGES.VALIDATION.GATEWAY_INVALID}. Supported gateways: ${validGateways.join(', ')}`
            );
        }

        const result = await firstValueFrom(
            this.client.send<{ success: boolean; payment?: PaymentResponseDto }>(
                PAYMENT_MS.PATTERN.HANDLE_WEBHOOK,
                {
                    gateway,
                    signature: signature || '',
                    payload,
                }
            )
        );

        if (result.payment) {
            try {
                await this.paymentStatusService.publishPaymentStatusChange(
                    result.payment.bookingId,
                    result.payment.paymentId,
                    result.payment.status,
                    {
                        transactionRef: result.payment.transactionRef,
                        paymentMethodCode: result.payment.paymentMethodCode,
                    }
                );
            } catch (error) {
                this.logger.warn(
                    `Failed to publish payment status change from webhook: ${(error as Error).message}`
                );
            }
        }

        return {
            success: true,
            message: 'Webhook processed successfully',
        };
    }
}