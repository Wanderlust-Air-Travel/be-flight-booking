import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { BookingStateStorageException } from '../exceptions/booking-state.exceptions';
import { RedisService } from '../modules/redis/redis.service';
import type { BookingState } from '../types/booking-state.types';
import { BookingStateRepository } from './booking-state.repository';

describe('BookingStateRepository', () => {
    let repository: BookingStateRepository;
    let redisService: RedisService;
    let _configService: ConfigService;

    const mockUserId = '019a8f4a-bb0e-7001-a0c4-27647b89dc71';
    const mockFlightInstanceId = '019a8f4a-bb0e-7002-a0c4-27647b89dc71';
    const mockBookingState: BookingState = {
        flightInstanceId: mockFlightInstanceId,
        cabin: {
            flightInstanceId: mockFlightInstanceId,
            cabinType: 'economy',
            fareClassCode: 'YS',
        },
        seat: {
            flightInstanceId: mockFlightInstanceId,
            flightSeatId: '019a8f4a-bb0e-7003-a0c4-27647b89dc71',
            seatNumber: '12A',
        },
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BookingStateRepository,
                {
                    provide: RedisService,
                    useValue: {
                        set: jest.fn(),
                        get: jest.fn(),
                        del: jest.fn(),
                        exists: jest.fn(),
                        ttl: jest.fn(),
                        keys: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue({
                            ttl: {
                                bookingState: 1800,
                            },
                        }),
                    },
                },
            ],
        }).compile();

        repository = module.get<BookingStateRepository>(BookingStateRepository);
        redisService = module.get<RedisService>(RedisService);
        _configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
        expect(repository).toBeDefined();
    });

    describe('save', () => {
        it('should save booking state successfully', async () => {
            jest.spyOn(redisService, 'set').mockResolvedValue(true);

            await repository.save(mockUserId, mockFlightInstanceId, mockBookingState);

            expect(redisService.set).toHaveBeenCalledWith(
                expect.stringContaining(`booking:state:${mockUserId}:${mockFlightInstanceId}`),
                mockBookingState,
                1800
            );
        });

        it('should throw BookingStateStorageException when save fails (returns false)', async () => {
            jest.spyOn(redisService, 'set').mockResolvedValue(false);

            await expect(
                repository.save(mockUserId, mockFlightInstanceId, mockBookingState)
            ).rejects.toThrow(BookingStateStorageException);
        });

        it('should throw BookingStateStorageException when Redis throws error', async () => {
            jest.spyOn(redisService, 'set').mockRejectedValue(new Error('Redis connection error'));

            await expect(
                repository.save(mockUserId, mockFlightInstanceId, mockBookingState)
            ).rejects.toThrow(BookingStateStorageException);
        });
    });

    describe('findOne', () => {
        it('should return booking state when exists', async () => {
            jest.spyOn(redisService, 'get').mockResolvedValue(mockBookingState);

            const result = await repository.findOne(mockUserId, mockFlightInstanceId);

            expect(result).toEqual(mockBookingState);
            expect(redisService.get).toHaveBeenCalledWith(
                expect.stringContaining(`booking:state:${mockUserId}:${mockFlightInstanceId}`)
            );
        });

        it('should return null when state does not exist', async () => {
            jest.spyOn(redisService, 'get').mockResolvedValue(null);

            const result = await repository.findOne(mockUserId, mockFlightInstanceId);

            expect(result).toBeNull();
        });

        it('should return null when Redis throws error (graceful handling)', async () => {
            jest.spyOn(redisService, 'get').mockRejectedValue(new Error('Redis error'));

            const result = await repository.findOne(mockUserId, mockFlightInstanceId);

            expect(result).toBeNull();
        });
    });

    describe('delete', () => {
        it('should delete booking state successfully', async () => {
            jest.spyOn(redisService, 'del').mockResolvedValue(true);

            const result = await repository.delete(mockUserId, mockFlightInstanceId);

            expect(result).toBe(true);
            expect(redisService.del).toHaveBeenCalledWith(
                expect.stringContaining(`booking:state:${mockUserId}:${mockFlightInstanceId}`)
            );
        });

        it('should return false when state does not exist', async () => {
            jest.spyOn(redisService, 'del').mockResolvedValue(false);

            const result = await repository.delete(mockUserId, mockFlightInstanceId);

            expect(result).toBe(false);
        });

        it('should return false when Redis throws error', async () => {
            jest.spyOn(redisService, 'del').mockRejectedValue(new Error('Redis error'));

            const result = await repository.delete(mockUserId, mockFlightInstanceId);

            expect(result).toBe(false);
        });
    });

    describe('deleteAllByUserId', () => {
        it('should delete all states for a user', async () => {
            const mockKeys = [
                `booking:state:${mockUserId}:${mockFlightInstanceId}`,
                `booking:state:${mockUserId}:another-flight-id`,
            ];

            jest.spyOn(redisService, 'keys').mockResolvedValue(mockKeys);
            jest.spyOn(redisService, 'del').mockResolvedValue(true);

            const result = await repository.deleteAllByUserId(mockUserId);

            expect(result).toBe(2);
            expect(redisService.keys).toHaveBeenCalledWith(
                expect.stringContaining(`booking:state:${mockUserId}:*`)
            );
            expect(redisService.del).toHaveBeenCalledTimes(2);
        });

        it('should return 0 when no states exist', async () => {
            jest.spyOn(redisService, 'keys').mockResolvedValue([]);

            const result = await repository.deleteAllByUserId(mockUserId);

            expect(result).toBe(0);
        });

        it('should return 0 when Redis throws error', async () => {
            jest.spyOn(redisService, 'keys').mockRejectedValue(new Error('Redis error'));

            const result = await repository.deleteAllByUserId(mockUserId);

            expect(result).toBe(0);
        });
    });

    describe('exists', () => {
        it('should return true when state exists', async () => {
            jest.spyOn(redisService, 'exists').mockResolvedValue(true);

            const result = await repository.exists(mockUserId, mockFlightInstanceId);

            expect(result).toBe(true);
        });

        it('should return false when state does not exist', async () => {
            jest.spyOn(redisService, 'exists').mockResolvedValue(false);

            const result = await repository.exists(mockUserId, mockFlightInstanceId);

            expect(result).toBe(false);
        });
    });

    describe('getTtl', () => {
        it('should return TTL for existing state', async () => {
            jest.spyOn(redisService, 'ttl').mockResolvedValue(1800);

            const result = await repository.getTtl(mockUserId, mockFlightInstanceId);

            expect(result).toBe(1800);
        });

        it('should return -1 when no TTL is set', async () => {
            jest.spyOn(redisService, 'ttl').mockResolvedValue(-1);

            const result = await repository.getTtl(mockUserId, mockFlightInstanceId);

            expect(result).toBe(-1);
        });

        it('should return -2 when key does not exist', async () => {
            jest.spyOn(redisService, 'ttl').mockResolvedValue(-2);

            const result = await repository.getTtl(mockUserId, mockFlightInstanceId);

            expect(result).toBe(-2);
        });
    });
});
