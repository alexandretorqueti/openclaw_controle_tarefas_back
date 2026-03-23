var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const { getAbsoluteAvatarUrl } = require('../utils/avatarUrl');
const taskService = require('../services/taskService');
class UserController {
    constructor() {
        // Get all users
        this.getAllUsers = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const users = yield prisma.user.findMany({
                orderBy: {
                    name: 'asc'
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    nickname: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            // Convert relative avatar URLs to absolute URLs
            const usersWithAbsoluteUrls = users.map(user => (Object.assign(Object.assign({}, user), { avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl) })));
            res.json({
                count: users.length,
                users: usersWithAbsoluteUrls,
                correlationId: req.correlationId
            });
        }));
        // Get user by ID
        this.getUserById = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const user = yield prisma.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    nickname: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            if (!user) {
                const error = new Error(`User with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            // Convert relative avatar URL to absolute URL
            const userWithAbsoluteUrl = Object.assign(Object.assign({}, user), { avatarUrl: this.getAbsoluteAvatarUrl(req, user.avatarUrl) });
            res.json(Object.assign(Object.assign({}, userWithAbsoluteUrl), { correlationId: req.correlationId }));
        }));
        // Get current user (from session)
        this.getCurrentUser = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            if (!req.session.userId) {
                const error = new Error('Not authenticated');
                error.statusCode = 401;
                throw error;
            }
            const user = yield prisma.user.findUnique({
                where: { id: req.session.userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            if (!user) {
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }
            res.json(Object.assign(Object.assign({}, user), { correlationId: req.correlationId }));
        }));
        // Create a new user
        this.createUser = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { name, email, avatarUrl, role = 'Viewer', nickname } = req.body;
            if (!name || !email) {
                const error = new Error('Name and email are required');
                error.statusCode = 400;
                throw error;
            }
            // Generate nickname from email if not provided
            let finalNickname = nickname;
            if (!finalNickname) {
                finalNickname = email.split('@')[0];
            }
            // Check if email already exists
            const existingUserByEmail = yield prisma.user.findUnique({
                where: { email }
            });
            if (existingUserByEmail) {
                const error = new Error('User with this email already exists');
                error.statusCode = 400;
                throw error;
            }
            // Check if nickname already exists
            const existingUserByNickname = yield prisma.user.findUnique({
                where: { nickname: finalNickname }
            });
            if (existingUserByNickname) {
                const error = new Error('User with this nickname already exists');
                error.statusCode = 400;
                throw error;
            }
            const user = yield prisma.user.create({
                data: {
                    name,
                    email,
                    nickname: finalNickname,
                    avatarUrl,
                    role
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    nickname: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            // Convert relative avatar URL to absolute URL
            const userWithAbsoluteUrl = Object.assign(Object.assign({}, user), { avatarUrl: getAbsoluteAvatarUrl(req, user.avatarUrl) });
            res.status(201).json({
                message: 'User created successfully',
                user: userWithAbsoluteUrl,
                correlationId: req.correlationId
            });
        }));
        // Update user
        this.updateUser = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { name, email, avatarUrl, role, nickname } = req.body;
            // Check if user exists
            const existingUser = yield prisma.user.findUnique({
                where: { id }
            });
            if (!existingUser) {
                const error = new Error(`User with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            // Check if email is being changed and if it already exists
            if (email && email !== existingUser.email) {
                const userWithEmail = yield prisma.user.findUnique({
                    where: { email }
                });
                if (userWithEmail) {
                    const error = new Error('Email already in use by another user');
                    error.statusCode = 400;
                    throw error;
                }
            }
            // Check if nickname is being changed and if it already exists
            if (nickname && nickname !== existingUser.nickname) {
                const userWithNickname = yield prisma.user.findUnique({
                    where: { nickname }
                });
                if (userWithNickname) {
                    const error = new Error('Nickname already in use by another user');
                    error.statusCode = 400;
                    throw error;
                }
            }
            const updatedUser = yield prisma.user.update({
                where: { id },
                data: {
                    name,
                    email,
                    nickname,
                    avatarUrl,
                    role
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    nickname: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            // Convert relative avatar URL to absolute URL
            const userWithAbsoluteUrl = Object.assign(Object.assign({}, updatedUser), { avatarUrl: getAbsoluteAvatarUrl(req, updatedUser.avatarUrl) });
            res.json({
                message: 'User updated successfully',
                user: userWithAbsoluteUrl,
                correlationId: req.correlationId
            });
        }));
        // Delete user
        this.deleteUser = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // Check if user exists
            const existingUser = yield prisma.user.findUnique({
                where: { id }
            });
            if (!existingUser) {
                const error = new Error(`User with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            // Check if user has created any projects
            const userProjects = yield prisma.project.findFirst({
                where: { createdById: id }
            });
            if (userProjects) {
                const error = new Error('Cannot delete user who has created projects');
                error.statusCode = 400;
                throw error;
            }
            // Check if user has created any tasks
            const userTasks = yield prisma.task.findFirst({
                where: { createdById: id }
            });
            if (userTasks) {
                const error = new Error('Cannot delete user who has created tasks');
                error.statusCode = 400;
                throw error;
            }
            // Check if user is assigned to any tasks
            const assignedTasks = yield prisma.task.findFirst({
                where: { assignedToId: id }
            });
            if (assignedTasks) {
                const error = new Error('Cannot delete user who is assigned to tasks');
                error.statusCode = 400;
                throw error;
            }
            yield prisma.user.delete({
                where: { id }
            });
            res.json({
                message: 'User deleted successfully',
                correlationId: req.correlationId
            });
        }));
        // Get next task for a user by nickname
        this.getNextTaskByNickname = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { nickname } = req.params;
            // 1. Find the user
            const user = yield prisma.user.findUnique({
                where: { nickname }
            });
            if (!user) {
                const error = new Error(`User with nickname ${nickname} not found`);
                error.statusCode = 404;
                throw error;
            }
            // Usamos o taskService, método getNextTaskForUser
            const nextTask = yield taskService.getNextTaskForUser(nickname);
            if (!nextTask) {
                return res.json({
                    success: false,
                    task: null,
                    correlationId: req.correlationId
                });
            }
            return res.json({
                success: true,
                task: nextTask,
                correlationId: req.correlationId
            });
        }));
        // Upload avatar for user
        this.uploadAvatar = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.body;
            if (!userId) {
                const error = new Error('User ID is required');
                error.statusCode = 400;
                throw error;
            }
            if (!req.file) {
                const error = new Error('No file uploaded');
                error.statusCode = 400;
                throw error;
            }
            // Check if user exists
            const user = yield prisma.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                const error = new Error(`User with ID ${userId} not found`);
                error.statusCode = 404;
                throw error;
            }
            // Generate avatar URL
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
            // Update user with new avatar URL
            const updatedUser = yield prisma.user.update({
                where: { id: userId },
                data: { avatarUrl },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    nickname: true,
                    avatarUrl: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            res.json({
                success: true,
                message: 'Avatar uploaded successfully',
                user: updatedUser,
                avatarUrl: avatarUrl,
                correlationId: req.correlationId
            });
        }));
    }
}
module.exports = new UserController();
