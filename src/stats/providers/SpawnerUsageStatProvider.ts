import { SPAWNER_BUS_NAME, SpawnerChannel, CreepCreatedEvent } from "bus/SpawnerEvents";
import { IOwnedRoomManager } from "interfaces";
import { StatProvider } from "stats/interfaces";

interface SpawnerUsageChunk {
    duration: number
    ends: number
}

interface SpawnerUsageData {
    spawnId: Id<StructureSpawn>
    chunks: SpawnerUsageChunk[]
}

export interface SpawnerUsageMemory {
    spawnerUsage?: {
        [key: string] : SpawnerUsageData
    }
}

export interface AverageSpawnUsage {
    spawn: StructureSpawn | null
    usage: number
    ticksUsed: number
}

export class SpawnerUsageStatProvider implements StatProvider {
    constructor(
        private memory: SpawnerUsageMemory,
        private room: IOwnedRoomManager,
    ) {
        if(!this.memory.spawnerUsage) {
            this.memory.spawnerUsage = {}
        }

        this.room?.getEventBus()
            .getBus(SPAWNER_BUS_NAME)
            .subscribe(SpawnerChannel.CREEP_CREATED, this.handleSpawnEvent.bind(this))
    }

    run() {
        if(!this.memory.spawnerUsage) {
            return
        }

        for(const spawnId of Object.keys(this.memory.spawnerUsage)) {
            this.memory.spawnerUsage[spawnId].chunks = this.memory.spawnerUsage[spawnId].chunks.filter(data => data.ends >= Game.time)
        }
    }

    getAverageUsage(): AverageSpawnUsage[] {
        if(!this.memory.spawnerUsage) {
            return []
        }

        return Object.values(this.memory.spawnerUsage).map(data => {
            const spawn = Game.getObjectById(data.spawnId)
            const ticksUsed = data.chunks.map(chunk => chunk.duration).reduce((a, b) => a + b, 0)
            return {
                spawn: spawn,
                ticksUsed: ticksUsed,
                usage: Math.round(ticksUsed/CREEP_LIFE_TIME*100*100)/100,
            }
        })
    }

    private handleSpawnEvent(event: CreepCreatedEvent) {
        if(!this.memory.spawnerUsage) {
            return
        }

        const spawnerId = event.spawnerId

        if(!this.memory.spawnerUsage[spawnerId]) {
            this.memory.spawnerUsage[spawnerId] = {
                spawnId: spawnerId,
                chunks: []
            }
        }

        this.memory.spawnerUsage[spawnerId].chunks.push({
            duration: event.duration,
            ends: Game.time + CREEP_LIFE_TIME,
        })
    }
}
