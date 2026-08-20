"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMessageHandler = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
let AdminMessageHandler = (() => {
    let _classDecorators = [(0, common_1.Controller)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _instanceExtraInitializers = [];
    let _getDashboard_decorators;
    let _getAuditLogs_decorators;
    let _manageFlights_decorators;
    var AdminMessageHandler = class {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _getDashboard_decorators = [(0, microservices_1.MessagePattern)('admin_get_dashboard')];
            _getAuditLogs_decorators = [(0, microservices_1.MessagePattern)('admin_get_audit_logs')];
            _manageFlights_decorators = [(0, microservices_1.MessagePattern)('admin_manage_flights')];
            __esDecorate(this, null, _getDashboard_decorators, { kind: "method", name: "getDashboard", static: false, private: false, access: { has: obj => "getDashboard" in obj, get: obj => obj.getDashboard }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getAuditLogs_decorators, { kind: "method", name: "getAuditLogs", static: false, private: false, access: { has: obj => "getAuditLogs" in obj, get: obj => obj.getAuditLogs }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _manageFlights_decorators, { kind: "method", name: "manageFlights", static: false, private: false, access: { has: obj => "manageFlights" in obj, get: obj => obj.manageFlights }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            AdminMessageHandler = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        getDashboardHandler = __runInitializers(this, _instanceExtraInitializers);
        getAuditLogsHandler;
        manageFlightsHandler;
        constructor(getDashboardHandler, getAuditLogsHandler, manageFlightsHandler) {
            this.getDashboardHandler = getDashboardHandler;
            this.getAuditLogsHandler = getAuditLogsHandler;
            this.manageFlightsHandler = manageFlightsHandler;
        }
        async getDashboard(payload) {
            return this.getDashboardHandler.execute({ periodDays: payload?.periodDays ?? 30 });
        }
        async getAuditLogs(payload) {
            return this.getAuditLogsHandler.execute({
                limit: payload?.limit ?? 50,
                offset: payload?.offset ?? 0,
            });
        }
        async manageFlights(payload) {
            return this.manageFlightsHandler.execute({
                action: payload.action,
                payload: payload.payload,
            });
        }
    };
    return AdminMessageHandler = _classThis;
})();
exports.AdminMessageHandler = AdminMessageHandler;
