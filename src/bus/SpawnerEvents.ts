import { CreepRole } from "../constants"

export const SPAWNER_BUS_NAME = "spawnerBus"

export enum SpawnerChannel {
    CREEP_CREATED = 'creepCreated'
}

export interface CreepCreatedEvent {
    spawnId: string
    roomName: string
    role: CreepRole
    creepName: string
}

export type SpawnerEvents = {
    [SpawnerChannel.CREEP_CREATED]: CreepCreatedEvent
}
