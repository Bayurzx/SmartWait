import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean up existing data
  await prisma.smsNotification.deleteMany();
  await prisma.queuePosition.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.staffSession.deleteMany();

  console.log('✅ Cleaned existing data');

  // Create sample patients
  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        name: 'John Doe',
        phone: '+1234567890',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Jane Smith',
        phone: '+1234567891',
      },
    }),
    prisma.patient.create({
      data: {
        name: 'Bob Johnson',
        phone: '+1234567892',
      },
    }),
  ]);

  console.log('✅ Created sample patients');

  // Create sample queue positions
  await Promise.all([
    prisma.queuePosition.create({
      data: {
        patientId: patients[0].id,
        position: 1,
        status: 'waiting',
        estimatedWaitMinutes: 15,
      },
    }),
    prisma.queuePosition.create({
      data: {
        patientId: patients[1].id,
        position: 2,
        status: 'waiting',
        estimatedWaitMinutes: 30,
      },
    }),
    prisma.queuePosition.create({
      data: {
        patientId: patients[2].id,
        position: 3,
        status: 'waiting',
        estimatedWaitMinutes: 45,
      },
    }),
  ]);

  console.log('✅ Created sample queue positions');

  // Create sample SMS notifications
  await Promise.all([
    prisma.smsNotification.create({
      data: {
        patientId: patients[0].id,
        phoneNumber: patients[0].phone,
        message: 'Hello John Doe! You\'re checked in at position 1. Estimated wait: 15 minutes.',
        status: 'sent',
        twilioSid: 'SM1234567890abcdef',
      },
    }),
    prisma.smsNotification.create({
      data: {
        patientId: patients[1].id,
        phoneNumber: patients[1].phone,
        message: 'Hello Jane Smith! You\'re checked in at position 2. Estimated wait: 30 minutes.',
        status: 'sent',
        twilioSid: 'SM1234567890abcdeg',
      },
    }),
  ]);

  console.log('✅ Created sample SMS notifications');

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });