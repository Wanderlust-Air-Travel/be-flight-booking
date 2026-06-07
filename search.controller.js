"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SearchMsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchMsController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const search_messages_1 = require("./search.messages");
const search_service_1 = require("./search.service");
let SearchMsController = SearchMsController_1 = class SearchMsController {
    searchService;
    logger = new common_1.Logger(SearchMsController_1.name);
    constructor(searchService) {
        this.searchService = searchService;
    }
    async handleSearch(data) {
        try {
            this.logger.debug(`Search flights - received data type: ${typeof data}, isArray: ${Array.isArray(data)}, isObject: ${typeof data === 'object' && data !== null}`);
            this.logger.debug(`Search flights - data value: ${JSON.stringify(data)}`);
            if (!data || typeof data !== 'object') {
                throw new Error(`Invalid data received: ${JSON.stringify(data)}`);
            }
            const result = await this.searchService.search(data);
            this.logger.log(`Found ${result.outbound?.length || 0} outbound flights`);
            return result;
        }
        catch (error) {
            this.logger.error('Search flights error:', error);
            throw error;
        }
    }
    async handleGetFareOptions(dto) {
        try {
            this.logger.log(`Get fare options: ${dto.flightInstanceId} - ${dto.cabinType}`);
            const result = await this.searchService.getFareOptions(dto);
            this.logger.log(`Found ${result.fareOptions?.length || 0} fare options`);
            return result;
        }
        catch (error) {
            this.logger.error('Get fare options error:', error);
            throw error;
        }
    }
    async handleGetSeatMap(dto) {
        try {
            this.logger.log(`Get seat map: ${dto.flightInstanceId} - ${dto.cabinType}`);
            const result = await this.searchService.getSeatMap(dto);
            this.logger.log(`Found ${result.seats.length} cabin groups with seats`);
            return result;
        }
        catch (error) {
            this.logger.error('Get seat map error:', error);
            throw error;
        }
    }
    async handleGetAirports() {
        try {
            this.logger.log('Get airports list');
            const airports = await this.searchService.getAirports();
            this.logger.log(`Found ${airports.length} airports`);
            return { airports };
        }
        catch (error) {
            this.logger.error('Get airports error:', error);
            throw error;
        }
    }
};
exports.SearchMsController = SearchMsController;
__decorate([
    (0, microservices_1.MessagePattern)(search_messages_1.SEARCH_MS.PATTERN.SEARCH_FLIGHTS),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], SearchMsController.prototype, "handleSearch", null);
__decorate([
    (0, microservices_1.MessagePattern)(search_messages_1.SEARCH_MS.PATTERN.GET_FARE_OPTIONS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], SearchMsController.prototype, "handleGetFareOptions", null);
__decorate([
    (0, microservices_1.MessagePattern)(search_messages_1.SEARCH_MS.PATTERN.GET_SEAT_MAP),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", Promise)
], SearchMsController.prototype, "handleGetSeatMap", null);
__decorate([
    (0, microservices_1.MessagePattern)(search_messages_1.SEARCH_MS.PATTERN.GET_AIRPORTS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SearchMsController.prototype, "handleGetAirports", null);
exports.SearchMsController = SearchMsController = SearchMsController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [search_service_1.SearchService])
], SearchMsController);
//# sourceMappingURL=search.controller.js.map