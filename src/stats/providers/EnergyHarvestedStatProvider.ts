import { RoomEventsChannel, ROOM_EVENTS_BUS_NAME, SourceHarvestedEvent } from "bus/RoomActionsEvents";
import { IRoomManager } from "interfaces";
import { StatProvider } from "stats/interfaces";


export interface EnergyHarvestedMemory {
    energyHarvested?: number
}

export class EnergyHarvestedStatProvider implements StatProvider {

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
}
