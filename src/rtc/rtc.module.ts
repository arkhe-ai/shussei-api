import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RtcService } from './rtc.service';
import { RtcController } from './rtc.controller';

@Module({
  imports: [AuthModule],
  controllers: [RtcController],
  providers: [
    {
      provide: 'LIVEKIT',
      useFactory: () => ({
        apiKey: process.env.LIVEKIT_API_KEY ?? '',
        apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
        wsUrl: process.env.LIVEKIT_WS_URL ?? process.env.LIVEKIT_URL ?? 'ws://localhost:7880',
      }),
    },
    {
      provide: RtcService,
      useFactory: (livekit: { apiKey: string; apiSecret: string; wsUrl: string }) =>
        new RtcService(livekit),
      inject: ['LIVEKIT'],
    },
  ],
})
export class RtcModule {}
