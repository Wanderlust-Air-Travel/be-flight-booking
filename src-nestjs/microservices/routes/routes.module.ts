import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from 'src/shared/entities/route/route.entity';
import { RoutesMsController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
    imports: [TypeOrmModule.forFeature([Route])],
    providers: [RoutesService],
    controllers: [RoutesMsController],
    exports: [RoutesService],
})
export class RoutesModule {}
