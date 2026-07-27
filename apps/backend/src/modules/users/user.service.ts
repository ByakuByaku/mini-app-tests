import { Role, User } from '../../generated/prisma/client';
import { db } from '../../db/client';

export interface TelegramUserInput {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export type PublicUser = {
  id: string;
  telegramId: string;
  username: string | null;
  fullName: string;
  role: Role;
  createdAt: string;
};

export type AuthUser = Pick<PublicUser, 'id' | 'telegramId' | 'role'>;

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    role: user.role,
  };
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const user = await db.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

export async function findUserByTelegramId(
  telegramId: bigint | number | string
): Promise<PublicUser | null> {
  const user = await db.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });
  return user ? toPublicUser(user) : null;
}

export async function upsertFromTelegram(
  tgUser: TelegramUserInput
): Promise<AuthUser> {
  const fullName = `${tgUser.first_name} ${tgUser.last_name ?? ''}`.trim();

  const user = await db.user.upsert({
    where: { telegramId: BigInt(tgUser.id) },
    update: {
      username: tgUser.username,
      fullName,
    },
    create: {
      telegramId: BigInt(tgUser.id),
      username: tgUser.username,
      fullName,
      role: 'STUDENT',
    },
  });

  return toAuthUser(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return users.map(toPublicUser);
}

export async function updateUserRole(
  userId: string,
  role: Role
): Promise<PublicUser> {
  const user = await db.user.update({
    where: { id: userId },
    data: { role },
  });
  return toPublicUser(user);
}
