import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DATABASE_ENTITIES } from './database/entities';
import { AuthModule } from './auth/auth.module';
import { MealsModule } from './meals/meals.module';
import { CalendarModule } from './calendar/calendar.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const url = configService.get<string>('DATABASE_URL');

        const baseConfig: TypeOrmModuleOptions = {
          type: 'postgres',
          entities: DATABASE_ENTITIES,
          synchronize: configService.get<string>('DB_SYNCHRONIZE') !== 'false',
          logging: configService.get<string>('DB_LOGGING') === 'true',
        };

        if (url) {
          return {
            ...baseConfig,
            url,
            ssl: buildSslOptions(configService),
          };
        }

        return {
          ...baseConfig,
          host: configService.get<string>('DB_HOST') ?? '127.0.0.1',
          port: Number.parseInt(
            configService.get<string>('DB_PORT') ?? '5432',
            10,
          ),
          username: configService.get<string>('DB_USER') ?? 'postgres',
          password: configService.get<string>('DB_PASSWORD') ?? 'postgres',
          database: configService.get<string>('DB_NAME') ?? 'calories',
          ssl: buildSslOptions(configService),
        };
      },
    }),
    AuthModule,
    MealsModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

function buildSslOptions(
  configService: ConfigService,
): false | { rejectUnauthorized: boolean } {
  const sslEnabled = configService.get<string>('DB_SSL') === 'true';

  if (!sslEnabled) {
    return false;
  }

  return {
    rejectUnauthorized:
      configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') === 'true',
  };
}
