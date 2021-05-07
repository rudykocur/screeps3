import { Spawner } from "Spawner";
import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { BuilderCreepTemplate, GenericCreepTemplate, HaulerCreepTemplate, MinerCreepTemplate } from "spawner/CreepSpawnTemplate";
import { MinerCreep } from "tasks/creeps/MinerCreep";
import { MinimalEnergyWorker } from "tasks/creeps/MinimalEnergyWorker";
import { CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER, CREEP_ROLE_MINER } from "../constants";
import { RoomAnalyst } from "./RoomAnalyst";
import { RoomBuilder } from "./RoomBuilder";
import { StructureWithEnergyStorage } from "types";
import { NeedGenerator } from "needs/NeedGenerator";

interface RoomManagerMemory {
    roomName: string
}

interface RoomManagerArgs {
    room: Room
}

@PersistentTask.register
export class RoomManager extends PersistentTask<RoomManagerMemory, RoomManagerArgs> {

    protected room: Room

    private spawner: Spawner;
    private temporaryStorage: Flag | undefined;
    private sources: Source[];
    private creeps: Creep[];
    private roomAnalyst: RoomAnalyst | null
    private roomBuilder: RoomBuilder | null
    private needGenerator: NeedGenerator | null

    initMemory(args: RoomManagerArgs): RoomManagerMemory {
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

        this.roomAnalyst = this.findTask(RoomAnalyst)
        this.roomBuilder = this.findTask(RoomBuilder)
        this.needGenerator = this.findTask(NeedGenerator)

        if(this.roomAnalyst && this.roomBuilder) {
            this.roomBuilder.setAnalyst(this.roomAnalyst)
        }
    }

    doRun(): RunResultType {
        if(!this.room) {
            return RunResult.DONE
        }

        if(!this.roomAnalyst) {
            this.roomAnalyst = this.scheduleBackgroundTask(RoomAnalyst, {
                room: this
            })
        }
        if(!this.roomBuilder) {
            this.roomBuilder = this.scheduleBackgroundTask(RoomBuilder, {
                room: this
            })
        }
        if(!this.needGenerator) {
            this.needGenerator = this.scheduleBackgroundTask(NeedGenerator, {
                room: this
            })
        }

        const tt = this.findTasks(MinimalEnergyWorker)

        if(tt.length === 0 && this.creeps.length <= 1) {
            this.doLevel0()
        }
        else {
            this.doLevel1()
        }

        this.spawner.run()
    }

    doLevel1() {
        this.manageMiners(1)
        this.manageHaulers(1)
        this.manageBuilders(2)
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

    getStructuresNeedingEnergy(): StructureWithEnergyStorage[] {
        return this.room.find<StructureSpawn>(FIND_MY_STRUCTURES, {
            filter: obj => {
                if(obj.structureType == STRUCTURE_SPAWN) {
                    //console.log('getStructuresNeedingEnergy', obj, '::', obj.store.getFreeCapacity(RESOURCE_ENERGY))
                }

                return obj.structureType == STRUCTURE_SPAWN && (obj.store.getFreeCapacity(RESOURCE_ENERGY) || 0) > 0
            }
        });
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

    private manageHaulers(maxHaulers: number) {
        if(!this.roomAnalyst || !this.needGenerator) {
            return
        }

        const haulers = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_HAULER);

        if(haulers.length < maxHaulers) {
            this.spawner.enqueue(new HaulerCreepTemplate(this));
        }

        this.needGenerator.assignTasks(haulers)
    }

    private manageMiners(maxMiners: number) {
        if(!this.roomAnalyst) {
            return
        }

        const miners = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_MINER);

        if(miners.length < maxMiners) {
            this.spawner.enqueue(new MinerCreepTemplate(this));
        }

        const minerJobs = this.findTasks(MinerCreep)
        const joblessMiners = miners.filter(creep =>
            minerJobs.find(job => job.getActorId() === creep.id) === undefined
        )

        if(joblessMiners.length > 0) {
            const sites = this.roomAnalyst.getMiningSites()

            const freeSites = sites.filter(site =>
                minerJobs.find(job => job.getSourceId() === site.source.id) === undefined
            )

            joblessMiners.forEach(miner => {
                const site = freeSites.shift()

                if(!site) {
                    return
                }

                this.scheduleBackgroundTask(MinerCreep, {
                    actor: miner,
                    source: site.source,
                    container: site.container
                })
            })
        }
    }

    private manageBuilders(maxBuilders: number) {
        const sites = this.roomAnalyst?.getConstructionSites() || []

        if(sites.length === 0 || !this.needGenerator) {
            return
        }

        const builders = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_BUILDER)

        if(builders.length < maxBuilders) {
            this.spawner.enqueue(new BuilderCreepTemplate(this))
        }

        this.needGenerator.assignTasks(builders)
    }

    get temporaryStoragePosition() {
        return this.temporaryStorage?.pos
    }

    getRoomAnalyst() {
        return this.roomAnalyst
    }

    get name() {
        return this.memory.roomName
    }

    toString() {
        return `[RoomManager ${this.memory.roomName}]`
    }
}
