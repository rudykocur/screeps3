import { IEventBus } from "bus/EventBus";
import { SpawnerChannel, SpawnerEvents, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { counter } from "GlobalCounter";
import { Logger } from "Logger";
import { CreepSpawnTemplate } from "spawner/CreepSpawnTemplate";
import { RoomAnalyst } from "tasks/RoomAnalyst";
import { RoomManager } from "tasks/RoomManager";

interface SpawnQueueEntry {
    template: CreepSpawnTemplate,
    spawnId: string
}

export enum SpawnPriority {
    LOW,
    NORMAL,
    HIGH,
}

class SpawnPriorityQueue {
    private lowPriority: SpawnQueueEntry[] = []
    private normalPriority: SpawnQueueEntry[] = []
    private highPriority: SpawnQueueEntry[] = []

    enqueue(entry: SpawnQueueEntry, priority: SpawnPriority) {
        switch(priority) {
            case SpawnPriority.HIGH:
                this.highPriority.push(entry)
                break
            case SpawnPriority.NORMAL:
                this.normalPriority.push(entry)
                break
            case SpawnPriority.LOW:
                this.lowPriority.push(entry)
                break
        }
    }

    shift(): SpawnQueueEntry | undefined {
        if(this.highPriority.length > 0) {
            return this.highPriority.shift()
        }

        if(this.normalPriority.length > 0) {
            return this.normalPriority.shift()
        }

        if(this.lowPriority.length > 0) {
            return this.lowPriority.shift()
        }

        return
    }

    get length() {
        return this.highPriority.length + this.normalPriority.length + this.lowPriority.length
    }
}

export class Spawner {
    private spawnQueue: SpawnPriorityQueue = new SpawnPriorityQueue()

    private logger = new Logger('Spawner')

    private spawners: StructureSpawn[]

    constructor(
        private roomName: string,
        private eventBus: IEventBus<SpawnerEvents>,
        private analyst: RoomAnalyst,
    ) {
        this.spawners = this.analyst.getSpawns()
    }

    canSpawn(): boolean {
        return this.spawners.find(s => s.spawning === null) != undefined;
    }

    run() {
        const freeSpawners = this.spawners.filter(s => s.spawning === null);

        this.logger.debug(this, `Running spawning. Spawners=${freeSpawners.length} queue=${this.spawnQueue.length}`)

        let structures: (StructureSpawn|StructureExtension)[] = this.analyst.getExtensionClusters().map(cluster => cluster.extensions).reduce((a, b) => a.concat(b))
        structures = structures.concat(this.spawners)

        while(freeSpawners.length > 0) {
            if(this.spawnQueue.length === 0) {
                return
            }

            const freeSpawner = freeSpawners.pop()
            const spawnEntry = this.spawnQueue.shift()

            if(freeSpawner && spawnEntry) {
                const template = spawnEntry.template

                const memory = template.getMemory()

                const creepName = `${this.roomName}-${freeSpawner.name}-${memory.role}-${Game.time}`;

                const result = freeSpawner.spawnCreep(template.getBodyParts(), creepName, {
                    memory: template.getMemory(),
                    energyStructures: structures
                })

                if(result === OK) {
                    this.logger.important(this, 'spawned creep', creepName)
                    this.logger.debug(`Creep spawning ${JSON.stringify(freeSpawner.spawning)}`)

                    this.eventBus.dispatch(SpawnerChannel.CREEP_CREATED, {
                        spawnId: spawnEntry.spawnId,
                        roomName: this.roomName,
                        role: memory.role,
                        creepName: creepName,
                    })
                }

                if(result == ERR_NOT_ENOUGH_ENERGY) {
                    // console.log(this, 'not enough energy to spawn', creepName, 'with body', template.getBodyParts());
                    return
                }
            }
        }
    }

    enqueue(template: CreepSpawnTemplate, priority: SpawnPriority = SpawnPriority.NORMAL) {
        const id = counter.generate()

        this.spawnQueue.enqueue({
            template: template,
            spawnId: id
        }, priority)

        this.logger.debug(this, `Creep added to [${priority}] queue body=${template.getBodyParts()} id=${id}`)

        return id
    }

    toString() {
        return `[Spawner ${this.roomName}]`
    }
}
