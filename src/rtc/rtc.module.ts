import { Module } from '@nestjs/common';
import { RtcService } from './rtc.service';
import { RtcController } from './rtc.controller';

@Module({
  controllers: [RtcController],
  providers: [
    {
      provide: 'LIVEKIT',
      useFactory: () => ({
        apiKey: process.env.LIVEKIT_API_KEY,
        apiSecret: process.env.LIVEKIT_API_SECRET,
        wsUrl: process.env.LIVEKIT_WS_URL,
        createAccessToken: () => {
          // Simplified mock for now - will need proper implementation
          return {
            addGrant: jest.fn(),
            toJwt: async () => 'jwt-token',
          };
        },
      }),
    },
    {
      provide: RtcService,
      useFactory: (livekit: any) => new RtcService(livekit),
      inject: ['LIVEKIT'],
    },
  ],
})
export class RtcModule {}
