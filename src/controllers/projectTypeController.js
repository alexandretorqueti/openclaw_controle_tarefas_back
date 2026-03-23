var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const prisma = require('../services/prismaService');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
class ProjectTypeController {
    constructor() {
        // Get all project types
        this.getAllProjectTypes = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const projectTypes = yield prisma.projectType.findMany({
                orderBy: {
                    name: 'asc'
                },
                include: {
                    projects: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            res.json({
                count: projectTypes.length,
                projectTypes,
                correlationId: req.correlationId
            });
        }));
        // Get project type by ID
        this.getProjectTypeById = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const projectType = yield prisma.projectType.findUnique({
                where: { id },
                include: {
                    projects: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            if (!projectType) {
                const error = new Error(`Project type with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            res.json(Object.assign(Object.assign({}, projectType), { correlationId: req.correlationId }));
        }));
        // Create a new project type
        this.createProjectType = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { name, persona_prompt, base_rules = '' } = req.body;
            if (!name) {
                const error = new Error('Name is required');
                error.statusCode = 400;
                throw error;
            }
            if (!persona_prompt) {
                const error = new Error('Persona prompt is required');
                error.statusCode = 400;
                throw error;
            }
            const projectType = yield prisma.projectType.create({
                data: {
                    name,
                    personaPrompt: persona_prompt,
                    baseRules: base_rules
                }
            });
            res.status(201).json({
                message: 'Project type created successfully',
                projectType,
                correlationId: req.correlationId
            });
        }));
        // Update project type
        this.updateProjectType = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { name, persona_prompt, base_rules } = req.body;
            // Check if project type exists
            const existingProjectType = yield prisma.projectType.findUnique({
                where: { id }
            });
            if (!existingProjectType) {
                const error = new Error(`Project type with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            const updatedProjectType = yield prisma.projectType.update({
                where: { id },
                data: {
                    name: name !== undefined ? name : existingProjectType.name,
                    personaPrompt: persona_prompt !== undefined ? persona_prompt : existingProjectType.personaPrompt,
                    baseRules: base_rules !== undefined ? base_rules : existingProjectType.baseRules
                }
            });
            res.json({
                message: 'Project type updated successfully',
                projectType: updatedProjectType,
                correlationId: req.correlationId
            });
        }));
        // Delete project type
        this.deleteProjectType = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // Check if project type exists
            const existingProjectType = yield prisma.projectType.findUnique({
                where: { id }
            });
            if (!existingProjectType) {
                const error = new Error(`Project type with ID ${id} not found`);
                error.statusCode = 404;
                throw error;
            }
            // Check if project type is being used by any projects
            const projectsWithType = yield prisma.project.findFirst({
                where: { projectTypeId: id }
            });
            if (projectsWithType) {
                const error = new Error('Cannot delete project type that is being used by projects');
                error.statusCode = 400;
                throw error;
            }
            yield prisma.projectType.delete({
                where: { id }
            });
            res.json({
                message: 'Project type deleted successfully',
                correlationId: req.correlationId
            });
        }));
    }
}
module.exports = new ProjectTypeController();
