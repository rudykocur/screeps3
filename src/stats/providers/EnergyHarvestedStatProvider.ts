import { RoomEventsChannel, ROOM_EVENTS_BUS_NAME, SourceHarvestedEvent } from "bus/RoomActionsEvents";
import { ThreatEventsChannel, ThreatStartedEvent, THREAT_EVENTS_BUS_NAME } from "bus/ThreatEvents";
import { IRoomManager } from "interfaces";
import { Logger } from "Logger";
import { StatProvider } from "stats/interfaces";


export interface EnergyHarvestedMemory {
    energyHarvested?: number
}

export class EnergyHarvestedStatProvider implements StatProvider {

    private logger = new Logger('EnergyHarvestedStatProvider')

    constructor(
        private memory: EnergyHarvestedMemory,
        private room: IRoomManager,
    ) {
        if(this.memory.energyHarvested === undefined) {
            this.memory.energyHarvested = 0
        }

        this.room.getEventBus()
            .getBus(ROOM_EVENTS_BUS_NAME)
            .subscribe(RoomEventsChannel.SOURCE_HARVESTED, this.handleSourceHarvested.bind(this))

        this.room.getEventBus()
            .getBus(THREAT_EVENTS_BUS_NAME)
            .subscribe(ThreatEventsChannel.THREAT_STARTED, this.handleThreatStarted.bind(this))
    }

    run() {}

    getHarvestedAmount() {
        return this.memory.energyHarvested || 0
    }

    private handleSourceHarvested(event: SourceHarvestedEvent) {
        if(this.memory.energyHarvested !== undefined) {
            this.memory.energyHarvested += event.amount
        }
    }

    private handleThreatStarted(event: ThreatStartedEvent) {
        if(this.memory.energyHarvested !== undefined && event.isInvader) {
            this.logger.email(`Invader attack started after gathering ${this.memory.energyHarvested} energy`, 5)
            this.logger.important('EnergyHarvestedStatProvider', `Invader attack started after gathering ${this.memory.energyHarvested} energy`)
            this.memory.energyHarvested = 0
        }
    }
}
