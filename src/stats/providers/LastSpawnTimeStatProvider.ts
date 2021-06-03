import { SPAWNER_BUS_NAME, SpawnerChannel, CreepCreatedEvent } from "bus/SpawnerEvents"
import { CreepRole } from "../../constants"
import { IOwnedRoomManager } from "interfaces"
import { Logger } from "Logger"
import { StatProvider } from "stats/interfaces"

export interface LastSpawnTimeMemory {
    lastSpawnTime?: {
        [key: string ] : number
    }
}

export class LastSpawnTimeStatProvider implements StatProvider {
    private logger = new Logger('LastSpawnTimeStatProvider')

    constructor(
        private memory: LastSpawnTimeMemory,
        private room: IOwnedRoomManager,
    ) {
        if(!this.memory.lastSpawnTime) {
            this.memory.lastSpawnTime = {}
        }

        this.room?.getEventBus()
            .getBus(SPAWNER_BUS_NAME)
            .subscribe(SpawnerChannel.CREEP_CREATED, this.handleSpawnEvent.bind(this))
    }

    getTicksSinceLastSpawn(role: CreepRole) {
        if(this.memory.lastSpawnTime && this.memory.lastSpawnTime[role]) {
            return Game.time - this.memory.lastSpawnTime[role]
        }

        return 0
    }

    run() {}

    handleSpawnEvent(event: CreepCreatedEvent) {
        if(this.memory.lastSpawnTime) {
            this.logger.debug(this, `Updated spawn time for role [${event.role}]`)
            this.memory.lastSpawnTime[event.role] = Game.time
        }
        else {
            this.logger.warn('No memory for spawn event', event.roomName, '::', event.role)
        }
    }

    toString() {
        return `[LastSpawnTimeStatProvider room=${this.room.label}]`
    }
}
