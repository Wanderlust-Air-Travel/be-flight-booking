import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from 'src/api-gateway/data-access/entities/role/role.entity';
import { UserRole } from 'src/api-gateway/data-access/entities/user/user-role.entity';
import { User } from 'src/api-gateway/data-access/entities/user/user.entity';
import { AuthModule } from '../auth/auth.module';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';

@Module({
    imports: [TypeOrmModule.forFeature([User, UserRole, Role]), AuthModule],
    controllers: [DevController],
    providers: [DevService],
})
export class DevModule {}
