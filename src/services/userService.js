var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const prisma = require('./prismaService');
class UserService {
    // Get all users
    getAllUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.user.findMany({
                select: {
                    id: true,
                    name: true,
                    nickname: true,
                    email: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
        });
    }
    // Get user by ID
    getUserById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    nickname: true,
                    email: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
        });
    }
    // Get user by email
    getUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.user.findUnique({
                where: { email },
                select: {
                    id: true,
                    name: true,
                    nickname: true,
                    email: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
        });
    }
    // Get user by nickname
    getUserByNickname(nickname) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.user.findUnique({
                where: { nickname },
                select: {
                    id: true,
                    name: true,
                    nickname: true,
                    email: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
        });
    }
}
module.exports = new UserService();
