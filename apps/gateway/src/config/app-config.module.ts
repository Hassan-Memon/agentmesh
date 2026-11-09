import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { validateEnv } from './env';

// @Global makes AppConfigService injectable everywhere without re-importing this module.
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Look for .env in the app folder and at the repo root (local dev convenience).
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
