import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import {
    BookingStateNotFoundException,
    CabinNotSelectedException,
    SeatNotSelectedException,
} from '../exceptions/booking-state.exceptions';
import { BookingStateRepository } from '../repositories/booking-state.repository';
import type { BookingState, CabinSelection, SeatSelection } from '../types/booking-state.types';
import { BookingStateService } from './booking-state.service';

describe('BookingStateService', () => {
    let service: BookingStateService;
    let repository: BookingStateRepository;

    const mockUserId = '019a8f4a-bb0e-7001-a0c4-27647b89dc71';
    const mockFlightInstanceId = '019a8f4a-bb0e-7002-a0c4-27647b89dc71';
    const mockCabinSelection: CabinSelection = {
        flightInstanceId: mockFlightInstanceId,
        cabinType: 'economy',
        fareClassCode: 'YS',
    };
    const mockSeatSelection: SeatSelection = {
        flightInstanceId: mockFlightInstanceId,
        flightSeatId: '019a8f4a-bb0e-7003-a0c4-27647b89dc71',
        seatNumber: '12A',
    };

    const mockBookingState: BookingState = {
        flightInstanceId: mockFlightInstanceId,
        cabin: mockCabinSelection,
        seat: mockSeatSelection,
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BookingStateService,
                {
                    provide: BookingStateRepository,
                    useValue: {
                        save: jest.fn().mockResolvedValue(undefined),
                        findOne: jest.fn(),
                        delete: jest.fn(),
                        deleteAllByUserId: jest.fn(),
                        exists: jest.fn(),
                        getTtl: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<BookingStateService>(BookingStateService);
        repository = module.get<BookingStateRepository>(BookingStateRepository);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('saveCabinSelection', () => {
        it('should save cabin selection successfully when state does not exist', async () => {
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);
            jest.spyOn(repository, 'save').mockResolvedValue(undefined);

            const result = await service.saveCabinSelection(mockUserId, mockCabinSelection);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Cabin selection saved successfully');
            expect(repository.findOne).toHaveBeenCalledWith(mockUserId, mockFlightInstanceId);
            expect(repository.save).toHaveBeenCalledWith(
                mockUserId,
                mockFlightInstanceId,
                expect.objectContaining({
                    flightInstanceId: mockFlightInstanceId,
                    cabin: mockCabinSelection,
                })
            );
        });

        it('should update existing state with new cabin selection', async () => {
            const existingState: BookingState = {
                flightInstanceId: mockFlightInstanceId,
                seat: mockSeatSelection,
                updatedAt: new Date(),
            };

            jest.spyOn(repository, 'findOne').mockResolvedValue(existingState);
            jest.spyOn(repository, 'save').mockResolvedValue(undefined);

            const result = await service.saveCabinSelection(mockUserId, mockCabinSelection);

            expect(result.success).toBe(true);
            expect(repository.save).toHaveBeenCalledWith(
                mockUserId,
                mockFlightInstanceId,
                expect.objectContaining({
                    flightInstanceId: mockFlightInstanceId,
                    cabin: mockCabinSelection,
                    seat: mockSeatSelection, // Existing seat should be preserved
                })
            );
        });

        it('should throw BadRequestException when fareClassCode is missing', async () => {
            const invalidPayload = {
                flightInstanceId: mockFlightInstanceId,
                cabinType: 'economy',
            } as unknown as CabinSelection;

            await expect(service.saveCabinSelection(mockUserId, invalidPayload)).rejects.toThrow(
                BadRequestException
            );
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when fareClassCode is undefined', async () => {
            const invalidPayload = {
                flightInstanceId: mockFlightInstanceId,
                cabinType: 'economy',
                fareClassCode: undefined,
            } as unknown as CabinSelection;

            await expect(service.saveCabinSelection(mockUserId, invalidPayload)).rejects.toThrow(
                BadRequestException
            );
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when cabinType is missing', async () => {
            const invalidPayload = {
                flightInstanceId: mockFlightInstanceId,
                fareClassCode: 'YS',
            } as unknown as CabinSelection;

            await expect(service.saveCabinSelection(mockUserId, invalidPayload)).rejects.toThrow(
                BadRequestException
            );
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when payload is null', async () => {
            await expect(
                service.saveCabinSelection(mockUserId, null as unknown as CabinSelection)
            ).rejects.toThrow(BadRequestException);
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should trim and uppercase fareClassCode before validation', async () => {
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);
            jest.spyOn(repository, 'save').mockResolvedValue(undefined);

            const result = await service.saveCabinSelection(mockUserId, {
                ...mockCabinSelection,
                fareClassCode: '  ys  ',
            });

            expect(result.success).toBe(true);
            expect(repository.save).toHaveBeenCalledWith(
                mockUserId,
                mockFlightInstanceId,
                expect.objectContaining({
                    cabin: expect.objectContaining({ fareClassCode: '  ys  ' }),
                }),
                false
            );
        });
    });

    describe('saveSeatSelection', () => {
        it('should save seat selection successfully when cabin is selected', async () => {
            const stateWithCabin: BookingState = {
                flightInstanceId: mockFlightInstanceId,
                cabin: mockCabinSelection,
                updatedAt: new Date(),
            };

            jest.spyOn(repository, 'findOne').mockResolvedValue(stateWithCabin);
            jest.spyOn(repository, 'save').mockResolvedValue(undefined);

            const result = await service.saveSeatSelection(mockUserId, mockSeatSelection);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Seat selection saved successfully');
            expect(repository.save).toHaveBeenCalledWith(
                mockUserId,
                mockFlightInstanceId,
                expect.objectContaining({
                    flightInstanceId: mockFlightInstanceId,
                    cabin: mockCabinSelection,
                    seat: mockSeatSelection,
                })
            );
        });

        it('should throw CabinNotSelectedException when cabin is not selected', async () => {
            const stateWithoutCabin: BookingState = {
                flightInstanceId: mockFlightInstanceId,
                updatedAt: new Date(),
            };

            jest.spyOn(repository, 'findOne').mockResolvedValue(stateWithoutCabin);

            await expect(service.saveSeatSelection(mockUserId, mockSeatSelection)).rejects.toThrow(
                CabinNotSelectedException
            );
            expect(repository.save).not.toHaveBeenCalled();
        });

        it('should throw CabinNotSelectedException when state does not exist', async () => {
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);

            await expect(service.saveSeatSelection(mockUserId, mockSeatSelection)).rejects.toThrow(
                CabinNotSelectedException
            );
            expect(repository.save).not.toHaveBeenCalled();
        });
    });

    describe('getBookingState', () => {
        it('should return booking state when exists', async () => {
            jest.spyOn(repository, 'findOne').mockResolvedValue(mockBookingState);

            const result = await service.getBookingState(mockUserId, mockFlightInstanceId);

            expect(result).toEqual(mockBookingState);
            expect(repository.findOne).toHaveBeenCalledWith(mockUserId, mockFlightInstanceId);
        });

        it('should return null when state does not exist', async () => {
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);

            const result = await service.getBookingState(mockUserId, mockFlightInstanceId);

            expect(result).toBeNull();
        });
    });

    describe('getSelectionsForReservation', () => {
        it('should return cabin and seat when both are selected', async () => {
            jest.spyOn(repository, 'findOne').mockResolvedValue(mockBookingState);

            const result = await service.getSelectionsForReservation(
                mockUserId,
                mockFlightInstanceId
            );

            expect(result.cabin).toEqual(mockCabinSelection);
            expect(result.seat).toEqual(mockSeatSelection);
        });

        it('should throw BookingStateNotFoundException when state does not exist', async () => {
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);

            await expect(
                service.getSelectionsForReservation(mockUserId, mockFlightInstanceId)
            ).rejects.toThrow(BookingStateNotFoundException);
        });

        it('should throw CabinNotSelectedException when cabin is not selected', async () => {
            const stateWithoutCabin: BookingState = {
                flightInstanceId: mockFlightInstanceId,
                seat: mockSeatSelection,
                updatedAt: new Date(),
            };

            jest.spyOn(repository, 'findOne').mockResolvedValue(stateWithoutCabin);

            await expect(
                service.getSelectionsForReservation(mockUserId, mockFlightInstanceId)
            ).rejects.toThrow(CabinNotSelectedException);
        });

        it('should throw SeatNotSelectedException when seat is not selected', async () => {
            const stateWithoutSeat: BookingState = {
                flightInstanceId: mockFlightInstanceId,
                cabin: mockCabinSelection,
                updatedAt: new Date(),
            };

            jest.spyOn(repository, 'findOne').mockResolvedValue(stateWithoutSeat);

            await expect(
                service.getSelectionsForReservation(mockUserId, mockFlightInstanceId)
            ).rejects.toThrow(SeatNotSelectedException);
        });
    });

    describe('clearBookingState', () => {
        it('should delete booking state successfully', async () => {
            jest.spyOn(repository, 'delete').mockResolvedValue(true);

            const result = await service.clearBookingState(mockUserId, mockFlightInstanceId);

            expect(result).toBe(true);
            expect(repository.delete).toHaveBeenCalledWith(mockUserId, mockFlightInstanceId);
        });

        it('should return false when state does not exist', async () => {
            jest.spyOn(repository, 'delete').mockResolvedValue(false);

            const result = await service.clearBookingState(mockUserId, mockFlightInstanceId);

            expect(result).toBe(false);
        });
    });

    describe('clearAllUserStates', () => {
        it('should delete all states for a user', async () => {
            jest.spyOn(repository, 'deleteAllByUserId').mockResolvedValue(5);

            const result = await service.clearAllUserStates(mockUserId);

            expect(result).toBe(5);
            expect(repository.deleteAllByUserId).toHaveBeenCalledWith(mockUserId);
        });
    });

    describe('exists', () => {
        it('should return true when state exists', async () => {
            jest.spyOn(repository, 'exists').mockResolvedValue(true);

            const result = await service.exists(mockUserId, mockFlightInstanceId);

            expect(result).toBe(true);
        });

        it('should return false when state does not exist', async () => {
            jest.spyOn(repository, 'exists').mockResolvedValue(false);

            const result = await service.exists(mockUserId, mockFlightInstanceId);

            expect(result).toBe(false);
        });
    });

    describe('getTtl', () => {
        it('should return TTL for existing state', async () => {
            jest.spyOn(repository, 'getTtl').mockResolvedValue(1800);

            const result = await service.getTtl(mockUserId, mockFlightInstanceId);

            expect(result).toBe(1800);
        });
    });
});
