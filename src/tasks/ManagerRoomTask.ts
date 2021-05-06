import { Spawner } from "Spawner";
import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { GenericCreepTemplate, MinerCreepTemplate } from "spawner/CreepSpawnTemplate";
import { TaskManager } from "TaskManager";
import { MinerTask } from "tasks/MinerTask";
import { MinimalEnergyWorker } from "tasks/MinimalEnergyWorker";
import { CREEP_ROLE_GENERIC, CREEP_ROLE_MINER } from "../constants";
import { RoomAnalyst } from "./RoomAnalyst";

interface ManagerRoomMemory {
    roomName: string
}

interface ManagerRoomArgs {
    room: Room
}

@PersistentTask.register
export class ManagerRoomTask extends PersistentTask<ManagerRoomMemory, ManagerRoomArgs> {

    protected room: Room

    private spawner: Spawner;
    private temporaryStorage: Flag | undefined;
    private sources: Source[];
    private creeps: Creep[];
    private roomAnalyst: RoomAnalyst | undefined

    initMemory(args: ManagerRoomArgs): ManagerRoomMemory {
        return {
            roomName: args.room.name
        }
    }

    doPreInit() {
        Game.manager.registerRoomManager(this);
    }

    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]

        if(!this.room) {
            return
        }

        const spawns = this.room.find<StructureSpawn>(FIND_MY_STRUCTURES, {
            filter: obj => obj.structureType == STRUCTURE_SPAWN
        });

        this.sources = this.room.find(FIND_SOURCES);

        this.spawner = new Spawner(spawns, this.room.name);

        this.creeps = this.room.find(FIND_MY_CREEPS);

        this.temporaryStorage = Object.values(Game.flags).find(flag =>
            flag.pos.roomName === this.room.name && flag.color === COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW)

        //this.roomAnalyst = this.findTasks(RoomAnalyst)[0]

        // console.log(this, 'OMG', this.findTasks(RoomAnalyst).map(obj => obj.constructor.name))
    }

    doRun(): RunResultType {
        if(!this.room) {
            return RunResult.DONE
        }

        if(this.findTasks(RoomAnalyst).length === 0) {
            this.scheduleBackgroundTask(RoomAnalyst, {
                room: this
            })
        }

        // console.log(this, 'tasks', this.childTasks, '::', this.findTasks(MinimalEnergyWorker))

        const tt = this.findTasks(MinimalEnergyWorker)

        if(tt) {
            this.doLevel1()
        }
        else {
            this.doLevel0()
        }

        this.spawner.run()
    }

    doLevel1() {
        //console.log('Do level 1')
        this.manageMiners(1)
    }

    doLevel0() {
        const baseCreeps = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_GENERIC)

        if(baseCreeps.length === 0) {
            this.spawner.enqueue(new GenericCreepTemplate(this));
        }

        if(baseCreeps.length === 1) {
            this.scheduleBackgroundTask(MinimalEnergyWorker, {
                actor: baseCreeps[0],
                source: this.sources[0],
                room: this,
            })
        }
    }

    getStructuresNeedingEnergy() {
        return this.room.find<Structure>(FIND_MY_STRUCTURES, {
            filter: obj => {
                if(obj.structureType == STRUCTURE_SPAWN) {
                    //console.log('getStructuresNeedingEnergy', obj, '::', obj.store.getFreeCapacity(RESOURCE_ENERGY))
                }

                return obj.structureType == STRUCTURE_SPAWN && (obj.store.getFreeCapacity(RESOURCE_ENERGY) || 0) > 0
            }
        });
    }

    getSafeSources(): Source[] {
        return this.sources.filter(source =>
            source.pos.findInRange(FIND_HOSTILE_STRUCTURES, 5).length === 0
        )
    }

    getDroppedResources() {
        const tempStorage = this.temporaryStoragePosition;

        return this.room.find(FIND_DROPPED_RESOURCES).filter(
            resource => {
                if(tempStorage && tempStorage.isEqualTo(resource)) {
                    return false
                }

                return resource.amount > 100
            }
        )
    }

    getMaxSpawnPower() {
        return this.room.energyCapacityAvailable
    }

    private manageMiners(maxMiners: number) {
        const miners = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_MINER);

        if(miners.length < maxMiners) {
            this.spawner.enqueue(new MinerCreepTemplate(this));
        }

        const minerJobs = this.findTasks(MinerTask)
        const joblessMiners = miners.filter(creep =>
            minerJobs.find(job => job.getActorId() === creep.id) === undefined
        )

        if(joblessMiners.length > 0) {
            const freeSources = this.getSafeSources().filter(source =>
                minerJobs.find(job => job.getSourceId() === source.id) === undefined
            )

            joblessMiners.forEach((miner, index) => {
                this.scheduleBackgroundTask(MinerTask, {
                    actor: miner,
                    source: freeSources[index]
                })
            })
        }
    }

    get temporaryStoragePosition() {
        return this.temporaryStorage?.pos
    }

    get name() {
        return this.memory.roomName
    }

    toString() {
        return `[RoomManager ${this.memory.roomName}]`
    }
}
