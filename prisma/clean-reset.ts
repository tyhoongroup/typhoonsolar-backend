import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function cleanResetAndSeedStaff() {
  console.log('--- CLEANING DATABASE & INITIALIZING CLEAN STAFF ONLY ---');

  // 1. Clean all transactional records in foreign-key dependency order
  await prisma.followupLog.deleteMany({});
  await prisma.paymentMilestone.deleteMany({});
  await prisma.materialDispatch.deleteMany({});
  await prisma.installationJob.deleteMany({});
  await prisma.serviceTicket.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.inquiry.deleteMany({});
  console.log('Cleared all inquiries, followups, payments, dispatches, jobs, and tickets.');

  // 2. Default staff password
  const defaultPassword = await bcrypt.hash('Typhoon@123', 12);

  // 3. Ensure all 10 core staff users exist cleanly
  const staff = [
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

  for (const u of staff) {
    await prisma.user.upsert({
      where: { phone: u.phone },
      update: {
        fullName: u.fullName,
        role: u.role,
        isActive: true,
      },
      create: {
        phone: u.phone,
        fullName: u.fullName,
        role: u.role,
        passwordHash: defaultPassword,
        isActive: true,
      },
    });
  }

  console.log('Successfully initialized 10 staff accounts. Next inquiry created will start from F-1.');
}

cleanResetAndSeedStaff()
  .catch((e) => {
    console.error('Error resetting database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
