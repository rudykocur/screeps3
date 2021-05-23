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

export class Spawner {
    private spawnQueue: SpawnQueueEntry[] = []

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

        const extensions = this.analyst.getExtensionClusters().map(cluster => cluster.extensions).reduce((a, b) => a.concat(b))

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
                    memory: template.getMemory()
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

    enqueue(template: CreepSpawnTemplate) {
        const id = counter.generate()

        this.spawnQueue.push({
            template: template,
            spawnId: id
        })

        this.logger.debug(this, 'added to queue', id, '::', template.getBodyParts())

        return id
    }

    toString() {
        return `[Spawner ${this.roomName}]`
    }
}
