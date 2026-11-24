import { PrismaClient, UserRole, ProjectStage, FollowupStatus, PaymentMilestoneType, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Typhoon Solar Database ---');

  // 1. Password Hashing
  const defaultPassword = await bcrypt.hash('Typhoon@123', 12);

  // 2. Seed Core Staff Users (Matching screens & notes)
  const users = [
    { phone: '9898950959', fullName: 'Altaf Pathan (Admin)', role: UserRole.ADMIN },
    { phone: '9000000001', fullName: 'Anand Kumar (Ops Manager)', role: UserRole.OPS_MANAGER },
    { phone: '9000000002', fullName: 'Amit (Salesperson)', role: UserRole.SALESPERSON },
    { phone: '9000000003', fullName: 'Kunal (Salesperson)', role: UserRole.SALESPERSON },
    { phone: '9000000004', fullName: 'Priya (Salesperson)', role: UserRole.SALESPERSON },
    { phone: '9000000005', fullName: 'Sohail bhai (Material Manager)', role: UserRole.MATERIAL_MANAGER },
    { phone: '9000000006', fullName: 'Rahul bhai (Portal User)', role: UserRole.PORTAL_USER },
    { phone: '9000000007', fullName: 'Meera (Accountant)', role: UserRole.ACCOUNTANT },
    { phone: '9000000008', fullName: 'Irfan (Installation Lead)', role: UserRole.INSTALLATION_TEAM },
    { phone: '9000000009', fullName: 'Zakir (Service Technician)', role: UserRole.SERVICE_TECH },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { phone: u.phone },
      update: {},
      create: {
        phone: u.phone,
        fullName: u.fullName,
        role: u.role,
        passwordHash: defaultPassword,
      },
    });
  }
  console.log('Seeded 10 staff users.');

  // 3. Find Salesperson & Ops Manager
  const amit = await prisma.user.findUnique({ where: { phone: '9000000002' } });
  const ops = await prisma.user.findUnique({ where: { phone: '9000000001' } });

  if (amit && ops) {
    // 4. Seed Sample Inquiry F-1024 (Ramesh Patel) - Matches Screen 1, 14, 17, 18
    const ramesh = await prisma.inquiry.upsert({
      where: { followupId: 'F-1024' },
      update: {},
      create: {
        followupId: 'F-1024',
        customerName: 'Ramesh Patel',
        customerPhone: '9825012345',
        address: 'Bunglow 14, Alkapuri',
        city: 'Vadodara',
        requestedKw: 6.0,
        meterPhase: 'Single Phase',
        isUrgent: true,
        currentStage: ProjectStage.SITE_VISIT_PLANNED,
        assignedSalespersonId: amit.id,
        quoteDueDays: 3,
      },
    });

    await prisma.followupLog.create({
      data: {
        inquiryId: ramesh.id,
        createdById: ops.id,
        stage: ProjectStage.INQUIRY_RECEIVED,
        status: FollowupStatus.CALL_DONE,
        description: 'Customer called. Wants a site visit this week for his bungalow.',
        committedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // in 2 days
      },
    });

    // 5. Seed Sample Inquiry F-1018 (Bhavna Joshi) - Matches Screen 19, 33, 34, 37
    const bhavna = await prisma.inquiry.upsert({
      where: { followupId: 'F-1018' },
      update: {},
      create: {
        followupId: 'F-1018',
        customerName: 'Bhavna Joshi',
        customerPhone: '9879054321',
        address: 'Plot 42, Gotri Road',
        city: 'Vadodara',
        requestedKw: 6.0,
        meterPhase: 'Three Phase',
        isUrgent: false,
        currentStage: ProjectStage.MATERIAL_UNLOADED,
        assignedSalespersonId: amit.id,
        dealAmount: 260000,
        closedAt: new Date(),
      },
    });

    // Seed Payment Milestones for Bhavna Joshi (Scenario matching screen 37)
    await prisma.paymentMilestone.createMany({
      data: [
        {
          inquiryId: bhavna.id,
          milestoneType: PaymentMilestoneType.BOOKING_ADVANCE,
          title: '1st term · Rs 1,60,000',
          amount: 160000,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          transactionRef: 'NEFT-88492048',
        },
        {
          inquiryId: bhavna.id,
          milestoneType: PaymentMilestoneType.MATERIAL_UNLOAD,
          title: 'After material unload · Rs 1,00,000',
          amount: 100000,
          status: PaymentStatus.PENDING,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        {
          inquiryId: bhavna.id,
          milestoneType: PaymentMilestoneType.INSTALLATION_METER,
          title: 'After installation and meter · Rs 60,000',
          amount: 60000,
          status: PaymentStatus.PENDING,
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    console.log('Seeded sample inquiries (F-1024, F-1018) & payment milestones.');
  }

  console.log('--- Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

