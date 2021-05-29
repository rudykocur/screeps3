import { CreepRole } from "../constants"

export const ROOM_EVENTS_BUS_NAME = "roomEventsBus"

export enum RoomEventsChannel {
    SOURCE_HARVESTED = 'sourceHarvested'
}

export interface SourceHarvestedEvent {
    actor: Creep
    amount: number
    roomName: string
}

export type RoomEvents = {
    [RoomEventsChannel.SOURCE_HARVESTED]: SourceHarvestedEvent
}
