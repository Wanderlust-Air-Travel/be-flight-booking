import { Injectable } from '@nestjs/common';
import { PassengerType } from '../constants/enums';
import type { Route } from '../entities/route/route.entity';
import type { PassengerFareDetails } from '../types/passenger-pricing.types';

/**
 * Service to calculate passenger pricing based on passenger type
 *
 * Pricing rules:
 * - ADT (Adult): Full price (base fare)
 * - CHD (Child, 2-11 years): 75% of adult base fare
 * - INF (Infant, under 2 years):
 *   - Domestic: 100,000 VNĐ per segment (excluding VAT)
 *   - International: 10% of adult base fare
 */
@Injectable()
export class PassengerPricingService {
    /**
     * Check if a route is domestic (within Vietnam)
     * Uses the is_domestic field from Route entity
     */
    private isDomesticRoute(route: Route): boolean {
        return route.is_domestic === true;
    }

    /**
     * Calculate base fare for a passenger based on their type
     *
     * @param adultBaseFare Base fare for adult (ADT)
     * @param passengerType Passenger type (ADT, CHD, INF)
     * @param route Route information (to determine if domestic or international)
     * @returns Base fare for the passenger
     */
    calculateBaseFare(adultBaseFare: number, passengerType: PassengerType, route: Route): number {
        switch (passengerType) {
            case PassengerType.ADT:
                // Adult: Full price
                return adultBaseFare;

            case PassengerType.CHD:
                // Child: 75% of adult base fare
                return Math.round(adultBaseFare * 0.75);

            case PassengerType.INF:
                // Infant pricing
                if (this.isDomesticRoute(route)) {
                    // Domestic: 100,000 VNĐ per segment (excluding VAT)
                    return 100000;
                }
                // International: 10% of adult base fare
                return Math.round(adultBaseFare * 0.1);

            default:
                throw new Error(`Unknown passenger type: ${passengerType}`);
        }
    }

    /**
     * Calculate tax amount for a passenger
     * Typically, tax is calculated as a percentage of base fare
     * For INF on domestic routes, tax might be 0 or minimal
     *
     * @param baseFare Base fare for the passenger
     * @param passengerType Passenger type
     * @param route Route information
     * @param taxRate Tax rate (as decimal, e.g., 0.1 for 10%)
     * @returns Tax amount
     */
    calculateTaxAmount(
        baseFare: number,
        passengerType: PassengerType,
        route: Route,
        taxRate = 0
    ): number {
        // For INF on domestic routes, tax is typically 0
        if (passengerType === PassengerType.INF && this.isDomesticRoute(route)) {
            return 0;
        }

        // For other cases, calculate tax based on base fare
        return Math.round(baseFare * taxRate);
    }

    /**
     * Calculate fee amount for a passenger
     * Fees might vary by passenger type
     *
     * @param baseFare Base fare for the passenger
     * @param passengerType Passenger type
     * @param route Route information
     * @param feeRate Fee rate (as decimal, e.g., 0.05 for 5%)
     * @returns Fee amount
     */
    calculateFeeAmount(
        baseFare: number,
        _passengerType: PassengerType,
        _route: Route,
        feeRate = 0
    ): number {
        // Fees are typically calculated as a percentage of base fare
        // You may want to adjust this based on your business rules
        return Math.round(baseFare * feeRate);
    }

    /**
     * Calculate total fare (base fare + tax + fees) for a passenger
     *
     * @param adultBaseFare Base fare for adult
     * @param passengerType Passenger type
     * @param route Route information
     * @param taxRate Tax rate (as decimal)
     * @param feeRate Fee rate (as decimal)
     * @returns Total fare breakdown
     */
    calculateTotalFare(
        adultBaseFare: number,
        passengerType: PassengerType,
        route: Route,
        taxRate = 0,
        feeRate = 0
    ): PassengerFareDetails {
        const baseFare = this.calculateBaseFare(adultBaseFare, passengerType, route);
        const taxAmount = this.calculateTaxAmount(baseFare, passengerType, route, taxRate);
        const feeAmount = this.calculateFeeAmount(baseFare, passengerType, route, feeRate);
        const totalAmount = baseFare + taxAmount + feeAmount;

        return {
            baseFare,
            taxAmount,
            feeAmount,
            totalAmount,
        };
    }
}
