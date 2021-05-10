// example declaration file - remove these and add your own custom typings

import { CreepRole } from "./constants";
import { GameManager } from "GameManager";
import { TaskManager } from "TaskManager";
import { AbstractTask } from "tasks/AbstractTask";

interface TaskMemory {}

interface TaskInitArgs {}

interface TaskRuntimeData {
    clazz: string
    parentTask?: string
    subTasks: string[]
    taskId: string
    data: TaskMemory
    suspended?: boolean
    sleepUntil?: number
}

type Optional<T> = T | null

export interface Type<T> extends Function { new (...args: any[]): T; }

export interface TaskType<T> extends Function { new (taskManager: TaskManager, taskId: string | undefined): T; }

interface RoomPositionJson {
    x: number;
    y: number;
    roomName: string;
}

type StructureWithEnergyStorage = StructureSpawn | StructureExtension
type StructureWithGeneralStorage = StructureContainer | StructureStorage

declare global {
    interface Memory {
        tasks?: Record<string, TaskRuntimeData>
    }

    interface CreepMemory {
        role: CreepRole
        room?: string
    }

    interface Game {
        manager: GameManager
    }
}
