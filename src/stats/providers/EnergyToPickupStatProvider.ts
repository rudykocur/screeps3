import { StatMemory, StatProvider } from "stats/interfaces"
import { StatsAggregator } from "stats/StatsAggregator"
import { RoomAnalyst } from "tasks/RoomAnalyst"

export interface EnergyToPickupMemory {
    energyToPickup?: StatMemory
}

export class EnergyToPickupStatProvider implements StatProvider {
    energyToPickupStats: StatsAggregator

    constructor(
        private memory: EnergyToPickupMemory,
    ) {
        if(!this.memory.energyToPickup) {
            this.memory.energyToPickup = {
                average: 0,
                partials: ""
            }
        }

        this.energyToPickupStats = new StatsAggregator('EnergyToPickup', this.memory.energyToPickup, 30)
    }

    getAverage() {
        return this.energyToPickupStats.average
    }

    run(analyst: RoomAnalyst) {
        const energyInResources = analyst.getDroppedResources()
            .map(res => res.amount)
            .reduce((a, b) => a + b, 0) || 0

        const energyInContainers = analyst.getMiningSites()
            .filter(site => site.container)
            .map(site => site.container?.store.getUsedCapacity(RESOURCE_ENERGY) || 0)
            .reduce((a, b) => a + b, 0) || 0

        this.energyToPickupStats.add(energyInResources + energyInContainers)
    }
}
