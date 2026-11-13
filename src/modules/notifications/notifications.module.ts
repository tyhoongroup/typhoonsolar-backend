import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FcmNotificationService } from './fcm.service';
import { SlaCronService } from './sla-cron.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [FcmNotificationService, SlaCronService],
  exports: [FcmNotificationService],
})
export class NotificationsModule {}

