import { NestFactory } from '@nestjs/core';
import { UserModule } from './domain/user/user.module';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
