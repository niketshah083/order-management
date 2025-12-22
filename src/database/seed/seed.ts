import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { UsersService } from 'src/users/users.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  if (!usersService) throw new Error('UsersService not found');
  await usersService.seedDefaultUsers();
  console.log('Seed complete');
  await app.close();
}
bootstrap();
