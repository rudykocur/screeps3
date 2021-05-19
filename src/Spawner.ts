import { SpawnerChannel, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { counter } from "GlobalCounter";
import { Logger } from "Logger";
import { CreepSpawnTemplate } from "spawner/CreepSpawnTemplate";
import { RoomManager } from "tasks/RoomManager";

interface SpawnQueueEntry {
    template: CreepSpawnTemplate,
    spawnId: string
}

export class Spawner {
    private spawnQueue: SpawnQueueEntry[] = []

    private logger = new Logger('Spawner')

    constructor(
        private structures: StructureSpawn[],
        private roomName: string,
        private room: RoomManager,
    ) {}

    canSpawn(): boolean {
        return this.structures.find(s => s.spawning === null) != undefined;
    }

    run() {
        const freeSpawners = this.structures.filter(s => s.spawning === null);

        this.logger.debug(this, `Running spawning. Spawners=${freeSpawners.length} queue=${this.spawnQueue.length}`)

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

                    this.room.getEventBus().getBus(SPAWNER_BUS_NAME).dispatch(SpawnerChannel.CREEP_CREATED, {
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
