const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.channelPresence.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.allowedUser.deleteMany({});
  await prisma.user.deleteMany({});

  // Create allowed users
  await prisma.allowedUser.createMany({
    data: [
      { email: 'admin@shussei.local' },
    ],
  });

  // Create channels
  await prisma.channel.createMany({
    data: [
      { name: 'general', type: 'text', position: 1 },
      { name: 'announcements', type: 'text', position: 2 },
      { name: 'voice-main', type: 'voice', position: 3 },
    ],
  });

  console.log('Seed completed');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
