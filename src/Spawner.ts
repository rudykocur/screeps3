import { CreepSpawnTemplate } from "spawner/CreepSpawnTemplate";

export class Spawner {
    private spawnQueue: CreepSpawnTemplate[] = []

    constructor(private structures: StructureSpawn[], private roomName: string) {}

    canSpawn(): boolean {
        return this.structures.find(s => s.spawning === null) != undefined;
    }

    run() {
        const freeSpawners = this.structures.filter(s => s.spawning === null);

        while(freeSpawners.length > 0) {
            if(this.spawnQueue.length === 0) {
                return
            }

            const freeSpawner = freeSpawners.pop()
            const template = this.spawnQueue.shift()

            if(freeSpawner && template) {
                const memory = template.getMemory()

                const creepName = `${this.roomName}-${freeSpawner.name}-${memory.role}-${Game.time}`;

                const result = freeSpawner.spawnCreep(template.getBodyParts(), creepName, {
                    memory: template.getMemory()
                })

                if(result === OK) {
                    console.log(this, 'spawned creep', creepName)
                }

                if(result == ERR_NOT_ENOUGH_ENERGY) {
                    // console.log(this, 'not enough energy to spawn', creepName, 'with body', template.getBodyParts());
                    return
                }
            }
        }
    }

    enqueue(template: CreepSpawnTemplate) {
        this.spawnQueue.push(template);
    }

    toString() {
        return `[Spawner ${this.roomName}]`
    }
}
