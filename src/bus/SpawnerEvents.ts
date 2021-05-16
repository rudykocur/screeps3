import { CreepRole } from "../constants"

export const SPAWNER_BUS_NAME = "spawnerBus"

export enum SpawnerChannel {
    CREEP_CREATED = 'creepCreated'
}

export interface CreepCreatedEvent {
    roomName: string
    role: CreepRole
}

export type SpawnerEvents = {
    [SpawnerChannel.CREEP_CREATED]: CreepCreatedEvent
}
