import { Spawner } from "Spawner";
import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { BuilderCreepTemplate, GenericCreepTemplate, HaulerCreepTemplate, MinerCreepTemplate } from "spawner/CreepSpawnTemplate";
import { CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER, CREEP_ROLE_MINER } from "../constants";
import { RoomAnalyst } from "./RoomAnalyst";
import { RoomBuilder } from "./RoomBuilder";
import { NeedGenerator } from "needs/NeedGenerator";
import { RoomDefender } from "./RoomDefender";
import { RoomStats } from "./RoomStats";
import { createEventBus, EventBusMaster, IEventBus } from "bus/EventBus";
import { SpawnerEvents, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { RemoteRoomManager } from "./RemoteRoomManager";
import { Logger } from "Logger";
import { IOwnedRoomManager } from "interfaces";

interface RoomManagerMemory {
    roomName: string
}

interface RoomManagerArgs {
    room: Room
}

@PersistentTask.register
export class RoomManager extends PersistentTask<RoomManagerMemory, RoomManagerArgs> implements IOwnedRoomManager {

    protected room: Room

    private spawner: Spawner;
    private temporaryStorage: Flag | undefined;
    private creeps: Creep[];
    private roomAnalyst: RoomAnalyst | null
    private roomBuilder: RoomBuilder | null
    private roomDefender: RoomDefender | null
    private roomStats: RoomStats | null
    private needGenerator: NeedGenerator | null
    private remoteRooms: RemoteRoomManager[]

    private bus: EventBusMaster<{
        [SPAWNER_BUS_NAME]: IEventBus<SpawnerEvents>
    }>

    private logger = new Logger('RoomManager')

    initMemory(args: RoomManagerArgs): RoomManagerMemory {
        return {
            roomName: args.room.name
        }
    }

    doPreInit() {
        Game.manager.registerRoomManager(this);

        this.bus = new EventBusMaster({
            [SPAWNER_BUS_NAME]: createEventBus<SpawnerEvents>()
        })
    }

    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]

        if(!this.room) {
            return
        }

        const spawns = this.room.find<StructureSpawn>(FIND_MY_STRUCTURES, {
            filter: obj => obj.structureType == STRUCTURE_SPAWN
        });

        this.spawner = new Spawner(spawns, this.room.name, this);

        this.creeps = this.room.find(FIND_MY_CREEPS);

        this.temporaryStorage = Object.values(Game.flags).find(flag =>
            flag.pos.roomName === this.room.name && flag.color === COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW)

        this.roomAnalyst = this.findTask(RoomAnalyst)
        this.roomBuilder = this.findTask(RoomBuilder)
        this.roomDefender = this.findTask(RoomDefender)
        this.roomStats = this.findTask(RoomStats)
        this.needGenerator = this.findTask(NeedGenerator)
        this.remoteRooms = this.findTasks(RemoteRoomManager)

        if(this.roomAnalyst) {
            this.roomDefender?.setAnalyst(this.roomAnalyst)
            this.roomBuilder?.setAnalyst(this.roomAnalyst)
            this.roomStats?.setAnalyst(this.roomAnalyst)
        }
    }

    doRun(): RunResultType {
        if(!this.room) {
            return RunResult.DONE
        }

        if(!this.roomAnalyst) {
            this.roomAnalyst = this.scheduleBackgroundTask(RoomAnalyst, {
                roomName: this.name
            })
        }
        if(!this.roomBuilder) {
            this.roomBuilder = this.scheduleBackgroundTask(RoomBuilder, {
                room: this
            })
        }
        if(!this.roomDefender) {
            this.roomDefender = this.scheduleBackgroundTask(RoomDefender, {
                room: this
            })
        }
        if(!this.roomStats) {
            this.roomStats = this.scheduleBackgroundTask(RoomStats, {
                room: this
            })
        }
        if(!this.needGenerator) {
            this.needGenerator = this.scheduleBackgroundTask(NeedGenerator, {
                room: this
            })
        }

        if(!this.roomAnalyst) {
            return
        }

        this.createRemoteRoomManagers(this.roomAnalyst)

        this.doLevel1()

        this.taskManager.runLast(() => this.spawner.run())
    }

    doLevel1() {
        if(!this.roomAnalyst || !this.roomStats) {
            return
        }

        if(this.roomAnalyst.isRoomAtCritical()) {
            this.doLevel0()
        }

        this.manageHaulers(1)
        this.manageMiners(1)
        this.manageHaulers(2)
        this.manageMiners(2)
        this.manageBuilders(1)
        this.manageGeneric(1)
        this.manageHaulers(3)

        if(this.roomStats.getAverageEnergyInStorage() > 5000 && this.roomStats.getTicksSinceLastSpawn(CREEP_ROLE_GENERIC) > 250) {
            this.manageGeneric(5)
        }
    }

    doLevel0() {
        if(!this.roomAnalyst || !this.needGenerator) {
            return
        }

        const baseCreeps = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_GENERIC)

        if(baseCreeps.length < 1) {
            this.spawner.enqueue(new GenericCreepTemplate(this, true));
        }

        this.needGenerator.assignTasks(baseCreeps)
    }

    private createRemoteRoomManagers(analyst: RoomAnalyst) {
        for(const remoteRoomName of analyst.getExpansionDirections()) {
            const remoteManager = this.remoteRooms.find(room => room.name === remoteRoomName)

            if(!remoteManager) {
                this.logger.important(this, 'Creating remote room manager for room', remoteRoomName)

                this.scheduleBackgroundTask(RemoteRoomManager, {
                    roomName: remoteRoomName,
                    parentRoom: this,
                })
            }
        }
    }

    getDroppedResources(withStorage: boolean = false) {
        const tempStorage = this.temporaryStoragePosition;

        return this.room.find(FIND_DROPPED_RESOURCES).filter(
            resource => {
                if(!withStorage && tempStorage && tempStorage.isEqualTo(resource)) {
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
        if(!this.roomAnalyst || !this.needGenerator) {
            return
        }

        const miners = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_MINER);

        if(miners.length < maxMiners) {
            this.spawner.enqueue(new MinerCreepTemplate(this));
        }

        this.needGenerator.assignTasks(miners)
    }

    private manageBuilders(maxBuilders: number) {
        const sites = this.roomAnalyst?.getConstructionSites() || []
        const toRepair = this.roomAnalyst?.getToRepair() || []

        if((sites.length === 0 && toRepair.length === 0) || !this.needGenerator) {
            return
        }

        const builders = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_BUILDER)

        if(builders.length < maxBuilders) {
            this.spawner.enqueue(new BuilderCreepTemplate(this))
        }

        this.needGenerator.assignTasks(builders)
    }

    private manageGeneric(maxActors: number) {
        if(!this.needGenerator) {
            return
        }

        const actors = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_GENERIC)

        if(actors.length < maxActors) {
            this.spawner.enqueue(new GenericCreepTemplate(this))
        }

        this.needGenerator.assignTasks(actors)
    }

    get temporaryStoragePosition() {
        return this.temporaryStorage?.pos
    }

    getRoomAnalyst() {
        return this.roomAnalyst
    }

    getEventBus() {
        return this.bus
    }

    getSpawner() {
        return this.spawner
    }

    getRemoteRoom(roomName: string) {
        return this.remoteRooms.find(room => room.name === roomName)
    }

    get name() {
        return this.memory.roomName
    }

    toString() {
        return `[RoomManager ${this.memory.roomName}]`
    }
}
