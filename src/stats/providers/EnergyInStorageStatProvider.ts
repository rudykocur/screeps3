import { StatMemory, StatProvider } from "stats/interfaces"
import { StatsAggregator } from "stats/StatsAggregator"
import { RoomAnalyst } from "tasks/RoomAnalyst"

export interface EnergyInStorageMemory {
    energyInStorage?: StatMemory
}

export class EnergyInStorageStatProvider implements StatProvider {
    private energyInStorage: StatsAggregator

    constructor(
        private memory: EnergyInStorageMemory,
    ) {
        if(!this.memory.energyInStorage) {
            this.memory.energyInStorage = {
                average: 0,
                partials: ""
            }
        }

        this.energyInStorage = new StatsAggregator('EnergyInStorage', this.memory.energyInStorage, 30)
    }

    getAverage() {
        return this.energyInStorage.average
    }

    run(analyst: RoomAnalyst) {
        this.energyInStorage.add(analyst.getStorage()?.getResourceAmount(RESOURCE_ENERGY) || 0)
    }
}
