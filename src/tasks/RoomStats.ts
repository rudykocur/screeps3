import { CreepCreatedEvent, SpawnerChannel, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { Logger } from "Logger";
import { RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { RoomAnalyst } from "./RoomAnalyst";
import { RoomManager } from "./RoomManager";

interface StatMemory {
    partials: string
    average: number
}

interface RoomStatsMemory {
    roomName: string
    energyToPickup?: StatMemory
}

interface RoomStatsArgs {
    room: RoomManager
}

@PersistentTask.register
export class RoomStats extends PersistentTask<RoomStatsMemory, RoomStatsArgs> {
    private analyst?: RoomAnalyst
    private room?: RoomManager | null
    private energyToPickupStats: StatsAggregator

    private logger = new Logger()

    initMemory(args: RoomStatsArgs): RoomStatsMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.manager.getRoomManager(this.memory.roomName)

        this.room?.getEventBus()
            .getBus(SPAWNER_BUS_NAME)
            .subscribe(SpawnerChannel.CREEP_CREATED, this.handleSpawnEvent)

        if(!this.memory.energyToPickup) {
            this.memory.energyToPickup = {
                average: 0,
                partials: ""
            }
        }

        this.energyToPickupStats = new StatsAggregator(this.memory.energyToPickup, 30)
    }

    doRun(): RunResultType {

        this.energyToPickupStats.add(this.getEnergyToPickup())

        this.sleep(20)
    }

    handleSpawnEvent(event: CreepCreatedEvent) {
        this.logger.important(this, "GOT DATA FOR SPAWN EVENT", event.roomName, '::', event.role)
    }

    getEnergyToPickup() {
        const energyInResources = this.analyst?.getDroppedResources()
            .map(res => res.amount)
            .reduce((a, b) => a + b, 0) || 0

        const energyInContainers = this.analyst?.getMiningSites()
            .filter(site => site.container)
            .map(site => site.container?.store.getUsedCapacity(RESOURCE_ENERGY) || 0)
            .reduce((a, b) => a + b, 0) || 0

            return energyInResources + energyInContainers
    }

    setAnalyst(anaylst: RoomAnalyst) {
        this.analyst = anaylst
    }

    toString() {
        return `[RoomStats ${this.memory.roomName}]`
    }
}

class StatsAggregator {
    constructor(
        private memory: StatMemory,
        private maxComponents: number
    ) {}

    add(value: number) {
        let parts = this.memory.partials ? this.memory.partials.split(',').map(part => parseInt(part)) : []

        parts.unshift(value)
        parts = parts.slice(0, this.maxComponents)

        this.memory.average = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)

        this.memory.partials = parts.join(',')
    }
}
