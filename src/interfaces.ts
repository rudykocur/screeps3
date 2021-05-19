import { EventBusMaster, IEventBus } from "bus/EventBus";
import { SPAWNER_BUS_NAME, SpawnerEvents } from "bus/SpawnerEvents";
import { Spawner } from "Spawner";
import { GenericTask } from "TaskManager";
import { PersistentTask } from "tasks/PersistentTask";
import { RoomAnalyst } from "tasks/RoomAnalyst";
import { TaskInitArgs, TaskMemory, TaskType } from "types";

export interface IRoomManager {
    name: string
    getRoomAnalyst(): RoomAnalyst | null
    getRemoteRoom(roomName: string): IRoomManager | undefined
    getDroppedResources(withStorage?: boolean): Resource<ResourceConstant>[]
}

export interface IOwnedRoomManager extends IRoomManager {
    getSpawner(): Spawner
    getEventBus(): EventBusMaster<{
        [SPAWNER_BUS_NAME]: IEventBus<SpawnerEvents>
    }>
}

export interface IScheduler {
    scheduleBlockingTask<M extends TaskMemory, IA extends TaskInitArgs, T extends PersistentTask<M, IA>>(
        taskFactory: TaskType<T>,
        args: IA,
    ): T

    scheduleChildTask<M extends TaskMemory, IA extends TaskInitArgs, T extends PersistentTask<M, IA>>(
        parent: GenericTask,
        taskFactory: TaskType<T>,
        args: IA,
    ): T

    scheduleBackgroundTask<M extends TaskMemory, IA extends TaskInitArgs, T extends PersistentTask<M, IA>>(
        taskFactory: TaskType<T>,
        args: IA,
    ): T

    findTask<T extends GenericTask>(
        clazz: TaskType<T>
    ): T | null

    findTasks<T extends GenericTask>(
        clazz: TaskType<T>
    ): T[]
}
