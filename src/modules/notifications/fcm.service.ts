import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class FcmNotificationService {
  private readonly logger = new Logger(FcmNotificationService.name);
  private isInitialized = false;

  constructor(private readonly prisma: PrismaService) {
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      try {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
          });
        }
        this.isInitialized = true;
        this.logger.log('Firebase Admin SDK initialized successfully.');
      } catch (err) {
        this.logger.warn('Failed to initialize Firebase Admin SDK. Push notifications will be logged only.');
      }
    } else {
      this.logger.warn('Firebase credentials not set in environment. Push notifications will be simulated.');
    }
  }

  async sendToUser(params: {
    userId: string;
    title: string;
    body: string;
    targetUrl?: string;
    isUrgent?: boolean;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { fcmToken: true, fullName: true },
    });

    if (!user || !user.fcmToken) {
      this.logger.log(`[SIMULATED PUSH] To: ${user?.fullName || params.userId} | ${params.title} - ${params.body}`);
      return;
    }

    if (!this.isInitialized) {
      this.logger.log(`[SIMULATED PUSH] To: ${user.fullName} | ${params.title} - ${params.body}`);
      return;
    }

    const message: admin.messaging.Message = {
      token: user.fcmToken,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: {
        url: params.targetUrl || '/',
      },
      webpush: {
        headers: { Urgency: params.isUrgent ? 'high' : 'normal' },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          vibrate: [200, 100, 200],
          requireInteraction: params.isUrgent ?? false,
        },
      },
    };

    try {
      await admin.messaging().send(message);
      this.logger.log(`Push notification sent to ${user.fullName}`);
    } catch (err) {
      this.logger.error(`Failed to send push to ${user.fullName}`, err);
    }
  }

  async sendToRole(role: UserRole, title: string, body: string, targetUrl?: string) {
    const users = await this.prisma.user.findMany({
      where: { role, isActive: true },
      select: { id: true },
    });

    for (const u of users) {
      await this.sendToUser({ userId: u.id, title, body, targetUrl });
    }
  }
}

