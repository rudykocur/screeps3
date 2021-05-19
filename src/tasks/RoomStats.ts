import { CreepCreatedEvent, SpawnerChannel, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { CreepRole, CREEP_ROLE_GENERIC } from "../constants";
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
    energyInStorage?: StatMemory
    lastSpawnTime?: {
        [key: string ] : number
    }
}

interface RoomStatsArgs {
    room: RoomManager
}

@PersistentTask.register
export class RoomStats extends PersistentTask<RoomStatsMemory, RoomStatsArgs> {
    private analyst?: RoomAnalyst
    private room?: RoomManager | null
    private energyToPickupStats: StatsAggregator
    private energyInStorage: StatsAggregator

    private logger = new Logger('RoomStats')

    initMemory(args: RoomStatsArgs): RoomStatsMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.manager.getRoomManager(this.memory.roomName)

        this.room?.getEventBus()
            .getBus(SPAWNER_BUS_NAME)
            .subscribe(SpawnerChannel.CREEP_CREATED, this.handleSpawnEvent.bind(this))

        if(!this.memory.energyToPickup) {
            this.memory.energyToPickup = {
                average: 0,
                partials: ""
            }
        }

        if(!this.memory.energyInStorage) {
            this.memory.energyInStorage = {
                average: 0,
                partials: ""
            }
        }

        if(!this.memory.lastSpawnTime) {
            this.memory.lastSpawnTime = {}
        }

        this.energyToPickupStats = new StatsAggregator('EnergyToPickup', this.memory.energyToPickup, 30)
        this.energyInStorage = new StatsAggregator('EnergyInStorage', this.memory.energyInStorage, 30)
    }

    doRun(): RunResultType {

        this.energyToPickupStats.add(this.getEnergyToPickup())
        this.energyInStorage.add(this.getEnergyInStorage())

        this.sleep(20)
    }

    handleSpawnEvent(event: CreepCreatedEvent) {
        if(this.memory.lastSpawnTime) {
            this.logger.important(this, "GOT DATA FOR SPAWN EVENT", event.roomName, '::', event.role)
            this.memory.lastSpawnTime[event.role] = Game.time
        }
        else {
            this.logger.warn('No memory for spawn event', event.roomName, '::', event.role)
        }
    }

    private getEnergyToPickup() {
        const energyInResources = this.analyst?.getDroppedResources()
            .map(res => res.amount)
            .reduce((a, b) => a + b, 0) || 0

        const energyInContainers = this.analyst?.getMiningSites()
            .filter(site => site.container)
            .map(site => site.container?.store.getUsedCapacity(RESOURCE_ENERGY) || 0)
            .reduce((a, b) => a + b, 0) || 0

            return energyInResources + energyInContainers
    }

    private getEnergyInStorage() {
        return this.analyst?.getStorage()?.getResourceAmount(RESOURCE_ENERGY) || 0
    }

    getAverageEnergyToPickup() {
        return this.energyToPickupStats.average
    }

    getAverageEnergyInStorage() {
        return this.energyInStorage.average
    }

    getTicksSinceLastSpawn(role: CreepRole) {
        if(this.memory.lastSpawnTime && this.memory.lastSpawnTime[role]) {
            return Game.time - this.memory.lastSpawnTime[role]
        }

        return 0
    }

    setAnalyst(anaylst: RoomAnalyst) {
        this.analyst = anaylst
    }

    toString() {
        return `[RoomStats ${this.memory.roomName}]`
    }
}

class StatsAggregator {
    private logger = new Logger('StatsAggregator')

    constructor(
        private name: string,
        private memory: StatMemory,
        private maxComponents: number
    ) {}

    get average() {
        return this.memory.average
    }

    add(value: number) {
        let parts = this.memory.partials ? this.memory.partials.split(',').map(part => parseInt(part)) : []

        parts.unshift(value)
        parts = parts.slice(0, this.maxComponents)

        this.memory.average = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)

        this.memory.partials = parts.join(',')

        this.logger.debug(`Added to set [${this.name}] new value`, value, ', average', this.memory.average)
    }
}
