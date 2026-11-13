import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './database/prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { FollowupsModule } from './modules/followups/followups.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { InstallationsModule } from './modules/installations/installations.module';
import { PortalModule } from './modules/portal/portal.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ServiceModule } from './modules/service/service.module';
import { TeamModule } from './modules/team/team.module';
import { CustomerModule } from './modules/customer-portal/customer.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // Rate Limiter: max 100 requests per minute
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    InquiriesModule,
    FollowupsModule,
    QuotationsModule,
    MaterialsModule,
    InstallationsModule,
    PortalModule,
    PaymentsModule,
    ServiceModule,
    TeamModule,
    CustomerModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

