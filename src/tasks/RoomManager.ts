import { Spawner } from "Spawner";
import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { BuilderCreepTemplate, GenericCreepTemplate, HaulerCreepTemplate, MinerCreepTemplate } from "spawner/CreepSpawnTemplate";
import { MinerCreep } from "tasks/creeps/MinerCreep";
import { MinimalEnergyWorker } from "tasks/creeps/MinimalEnergyWorker";
import { CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER, CREEP_ROLE_MINER } from "../constants";
import { RoomAnalyst } from "./RoomAnalyst";
import { RoomBuilder } from "./RoomBuilder";
import { BuilderCreep } from "./creeps/BuilderCreep";
import { StructureWithEnergyStorage } from "types";
import { HaulerCreep } from "./creeps/HaulerCreep";
import { DepositEnergy } from "./DepositEnergy";
import { PickupResourceTask } from "./PickupResource";
import { isTaskWithActor } from "TaskManager";
import { notEmpty } from "utils/common";
import { WithdrawEnergy } from "./WithdrawEnergy";
import { LoadEnergyTask } from "./LoadEnergyTask";

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

        if(this.roomAnalyst && this.roomBuilder) {
            this.roomBuilder.setAnalyst(this.roomAnalyst)
        }

        // console.log(this, 'OMG', this.findTasks(RoomAnalyst).map(obj => obj.constructor.name))
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

        // console.log(this, 'tasks', this.childTasks, '::', this.findTasks(MinimalEnergyWorker))
        // console.log('CTR SITES', this.roomAnalyst.getConstructionSites())

        const tt = this.findTasks(MinimalEnergyWorker)

        if(tt.length > 0) {
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
        if(!this.roomAnalyst) {
            return
        }

        const haulers = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_HAULER);

        if(haulers.length < maxHaulers) {
            this.spawner.enqueue(new HaulerCreepTemplate(this));
        }

        const tasks = this.getChildTasks()

        const joblessHaulers = haulers.filter(creep =>
            tasks.find(job => 'getActorId' in job && job.getActorId() === creep.id) === undefined
        )

        joblessHaulers.forEach(hauler => {

            const resources = this.getDroppedResources();
            const nearest = hauler.pos.findClosestByRange(resources);
            const containers = this.roomAnalyst
                ?.getMiningSites()
                .map(site => site.container)
                .filter(notEmpty)
                .filter(container => container.store.getUsedCapacity() > 100) || []
            const nearestContainer = hauler.pos.findClosestByRange(containers)

            if(!nearest && containers.length === 0) {
                return;
            }

            const parentTask = this.scheduleBackgroundTask(DepositEnergy, {
                actor: hauler,
                room: this,
            })

            if(nearest) {
                this.scheduleChildTask(parentTask, PickupResourceTask, {
                    actor: hauler,
                    resource: nearest
                })
            }
            else if(nearestContainer) {
                this.scheduleChildTask(parentTask, LoadEnergyTask, {
                    actor: hauler,
                    container: nearestContainer
                })
            }

        })
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

        if(sites.length === 0) {
            return
        }

        const builders = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_BUILDER)

        if(builders.length < maxBuilders) {
            this.spawner.enqueue(new BuilderCreepTemplate(this))
        }

        const builderJobs = this.findTasks(BuilderCreep)
        const joblessBuilders = builders.filter(creep =>
            builderJobs.find(job => job.getActorId() === creep.id) === undefined
        )

        if(joblessBuilders.length > 0) {
            joblessBuilders.forEach(builder => {
                this.scheduleBackgroundTask(BuilderCreep, {
                    actor: builder,
                    room: this
                })
            })
        }
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
