
export const THREAT_EVENTS_BUS_NAME = "threatEventsBus"

export enum ThreatEventsChannel {
    THREAT_STARTED = 'threatStarted',
    NEW_THREAT = 'newThreat',
    THREAT_ENDED = 'threatEnded',
}

export interface ThreatStartedEvent {
    isInvader: boolean
}

export interface NewThreatEvent {
    creep: Creep
    isHostile: boolean
}

export interface ThreatEndedEvent {}

export type ThreatEvents = {
    [ThreatEventsChannel.NEW_THREAT]: NewThreatEvent,
    [ThreatEventsChannel.THREAT_STARTED]: ThreatStartedEvent,
    [ThreatEventsChannel.THREAT_ENDED]: ThreatEndedEvent,
}
