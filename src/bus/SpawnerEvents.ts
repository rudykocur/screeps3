import { CreepRole } from "../constants"

export const SPAWNER_BUS_NAME = "spawnerBus"

export enum SpawnerChannel {
    CREEP_CREATED = 'creepCreated'
}

export interface CreepCreatedEvent {
    spawnId: string
    spawnerId: Id<StructureSpawn>
    roomName: string
    roomLabel: string
    role: CreepRole
    creepName: string
    duration: number
}

export type SpawnerEvents = {
    [SpawnerChannel.CREEP_CREATED]: CreepCreatedEvent
}
