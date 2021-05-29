import { EventBusMaster, IEventBus } from "bus/EventBus";
import { RoomEvents, ROOM_EVENTS_BUS_NAME } from "bus/RoomActionsEvents";
import { SPAWNER_BUS_NAME, SpawnerEvents } from "bus/SpawnerEvents";
import { ThreatEvents, THREAT_EVENTS_BUS_NAME } from "bus/ThreatEvents";
import { INeedGenerator } from "needs/interfaces";
import { Spawner } from "Spawner";
import { GenericTask } from "TaskManager";
import { PersistentTask } from "tasks/PersistentTask";
import { RoomAnalyst } from "tasks/RoomAnalyst";
import { ThreatStatus } from "tasks/RoomThreatManager";
import { TaskInitArgs, TaskMemory, TaskType } from "types";

export type RoomBus = EventBusMaster<{
    [ROOM_EVENTS_BUS_NAME]: IEventBus<RoomEvents>,
    [THREAT_EVENTS_BUS_NAME]: IEventBus<ThreatEvents>,
}>

export type OwnedRoomBus = EventBusMaster<{
    [SPAWNER_BUS_NAME]: IEventBus<SpawnerEvents>,
    [ROOM_EVENTS_BUS_NAME]: IEventBus<RoomEvents>,
    [THREAT_EVENTS_BUS_NAME]: IEventBus<ThreatEvents>,
}>

export interface IThreatManager {
    getThreatStatus(): ThreatStatus
}

export interface IRoomManager {
    name: string
    getRoomAnalyst(): RoomAnalyst | null
    getNeedGenerator(): INeedGenerator | null
    getDroppedResources(withStorage?: boolean): Resource<ResourceConstant>[]
    getEventBus(): RoomBus
    getThreatManager(): IThreatManager | null
}

export interface IOwnedRoomManager extends IRoomManager {
    getRemoteRoom(roomName: string): IRemoteRoom | undefined
    getSpawner(): Spawner | null | undefined
    getMaxSpawnPower(): number
    getEventBus(): OwnedRoomBus
}

export interface IRemoteRoom extends IRoomManager {
    parentRoomName: string | undefined
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
