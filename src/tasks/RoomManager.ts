import { Spawner, SpawnPriority } from "Spawner";
import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { BuilderCreepTemplate, GenericCreepTemplate, HaulerCreepTemplate, MinerCreepTemplate, ReserveCreepTemplate } from "spawner/CreepSpawnTemplate";
import { CreepRole, CREEP_ROLE_BUILDER, CREEP_ROLE_GENERIC, CREEP_ROLE_HAULER, CREEP_ROLE_MINER, CREEP_ROLE_RESERVE } from "../constants";
import { RoomAnalyst } from "./RoomAnalyst";
import { RoomBuilder } from "./RoomBuilder";
import { NeedGenerator } from "needs/NeedGenerator";
import { RoomDefender } from "./RoomDefender";
import { RoomStats } from "./RoomStats";
import { createEventBus, EventBusMaster } from "bus/EventBus";
import { SpawnerEvents, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { RemoteRoomManager } from "./RemoteRoomManager";
import { Logger } from "Logger";
import { IOwnedRoomManager, OwnedRoomBus } from "interfaces";
import { ROOM_EVENTS_BUS_NAME, RoomEvents } from "bus/RoomActionsEvents";
import { ThreatEvents, THREAT_EVENTS_BUS_NAME } from "bus/ThreatEvents";
import { RoomThreatManager } from "./RoomThreatManager";
import { nameSelector } from "utils/RoomNaming";

interface RoomManagerMemory {
    roomName: string
    roomLabel: string
    namingGroup: string
}

interface RoomManagerArgs {
    room: Room
}

@PersistentTask.register
export class RoomManager extends PersistentTask<RoomManagerMemory, RoomManagerArgs> implements IOwnedRoomManager {

    protected room: Room

    private spawner?: Spawner | undefined;
    private temporaryStorage: Flag | undefined;
    private creeps: Creep[];
    private roomAnalyst: RoomAnalyst | null
    private roomBuilder: RoomBuilder | null
    private roomDefender: RoomDefender | null
    private roomStats: RoomStats | null
    private roomThreatManager: RoomThreatManager | null
    private needGenerator: NeedGenerator | null
    private remoteRooms: RemoteRoomManager[]

    private bus: OwnedRoomBus

    private logger = new Logger('RoomManager')

    initMemory(args: RoomManagerArgs): RoomManagerMemory {
        const rooms = Game.manager.getOwnedRooms()
            .map(room => room.namingGroup)

        const namingGroup = nameSelector.selectGroup(rooms)
        const roomLabel = nameSelector.selectMainLocation(namingGroup) || ""

        return {
            roomName: args.room.name,
            namingGroup: namingGroup,
            roomLabel: roomLabel
        }
    }

    doPreInit() {
        Game.manager.registerOwnedRoomManager(this);

        this.bus = new EventBusMaster({
            [SPAWNER_BUS_NAME]: createEventBus<SpawnerEvents>(),
            [ROOM_EVENTS_BUS_NAME]: createEventBus<RoomEvents>(),
            [THREAT_EVENTS_BUS_NAME]: createEventBus<ThreatEvents>(),
        })
    }

    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]

        if(!this.room) {
            return
        }

        this.creeps = Object.values(Game.creeps).filter(creep => creep.memory.room === this.name);

        this.temporaryStorage = Object.values(Game.flags).find(flag =>
            flag.pos.roomName === this.room.name && flag.color === COLOR_YELLOW && flag.secondaryColor == COLOR_YELLOW)

        this.roomAnalyst = this.findTask(RoomAnalyst)
        this.roomBuilder = this.findTask(RoomBuilder)
        this.roomDefender = this.findTask(RoomDefender)
        this.roomThreatManager = this.findTask(RoomThreatManager)
        this.roomStats = this.findTask(RoomStats)
        this.needGenerator = this.findTask(NeedGenerator)
        this.remoteRooms = this.findTasks(RemoteRoomManager)

        this.remoteRooms.forEach(remoteRoom => {
            const generator = remoteRoom.getNeedGenerator()
            if(generator) {
                this.needGenerator?.registerGenerator(generator)
            }
        })

        if(this.roomAnalyst) {
            this.spawner = new Spawner(this, this.bus.getBus(SPAWNER_BUS_NAME), this.roomAnalyst)
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
        if(!this.roomThreatManager) {
            this.roomThreatManager = this.scheduleBackgroundTask(RoomThreatManager, {
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

        this.taskManager.runLast(() => this.spawner?.run())
    }

    doLevel1() {
        if(!this.roomAnalyst || !this.roomStats || !this.spawner) {
            return
        }

        if(this.roomAnalyst.isRoomAtCritical()) {
            this.doLevel0()
        }

        this.manageHaulers(1, false, SpawnPriority.HIGH)
        this.manageMiners(1, false, SpawnPriority.HIGH)
        this.manageHaulers(2, false, SpawnPriority.HIGH)
        this.manageMiners(2, false, SpawnPriority.NORMAL)
        this.manageGeneric(1)
        this.manageHaulers(3, false, SpawnPriority.NORMAL)

        this.manageRemoteActors()

        if(this.roomStats.getAverageEnergyInStorage() > 50000 && this.roomStats.getTicksSinceLastSpawn(CREEP_ROLE_GENERIC) > 250) {
            this.manageGeneric(5)
        }
    }

    doLevel0() {
        if(!this.roomAnalyst || !this.needGenerator || !this.spawner) {
            return
        }

        const baseCreeps = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_GENERIC)

        if(baseCreeps.length < 2) {
            this.spawner.enqueue(new GenericCreepTemplate(this, true), SpawnPriority.HIGH);
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

    private manageRemoteActors() {
        const remoteRooms = this.remoteRooms.filter(room => room.getNeedsReserver()).length

        this.manageReservers(remoteRooms)

        const totalMiners = this.remoteRooms
            .map(room => room.getRoomAnalyst()?.getMiningSites().length || 0)
            .reduce((a, b) => a + b, 0)

        this.manageMiners(totalMiners, true, SpawnPriority.NORMAL)

        const buildPoints = this.remoteRooms.map(
            room => room.getRoomAnalyst()?.getConstructionSites()
                .map(site => site.progressTotal - site.progress).reduce((a, b) => a+b, 0) || 0
        ).reduce((a, b) => a + b, 0)

        if(buildPoints > 0) {
            this.manageRemoteBuilders(1)
        }
        this.manageHaulers(6, true, SpawnPriority.NORMAL)
    }

    private manageHaulers(maxHaulers: number, remote: boolean, priority: SpawnPriority) {
        if(!this.needGenerator || !this.spawner) {
            return
        }

        const haulers = this.filterCreeps(CREEP_ROLE_HAULER, remote)

        if(haulers.length < maxHaulers) {
            this.spawner.enqueue(new HaulerCreepTemplate(this, remote), priority);
        }

        this.needGenerator.assignTasks(haulers, remote)
    }

    private manageMiners(maxMiners: number, remote = false, priority: SpawnPriority) {
        if(!this.roomAnalyst || !this.needGenerator || !this.spawner) {
            return
        }

        let miners = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_MINER);

        miners = miners.filter(creep => creep.memory.remote === remote)

        if(miners.length < maxMiners) {
            this.spawner.enqueue(new MinerCreepTemplate(this, remote), priority);
        }

        this.needGenerator.assignTasks(miners, remote)
    }

    private manageBuilders(maxBuilders: number, remote = false) {
        const sites = this.roomAnalyst?.getConstructionSites() || []

        if(sites.length === 0 || !this.needGenerator || !this.spawner) {
            return
        }

        let builders = this.filterCreeps(CREEP_ROLE_BUILDER, remote)

        if(builders.length < maxBuilders) {
            this.spawner.enqueue(new BuilderCreepTemplate(this, remote))
        }

        this.needGenerator.assignTasks(builders, remote)
    }

    private manageRemoteBuilders(maxBuilders: number) {
        if(!this.needGenerator || !this.spawner) {
            return
        }

        const remote = true

        let builders = this.filterCreeps(CREEP_ROLE_BUILDER, remote)

        if(builders.length < maxBuilders) {
            this.spawner.enqueue(new BuilderCreepTemplate(this, remote))
        }

        this.needGenerator.assignTasks(builders, remote)
    }

    private manageGeneric(maxActors: number) {
        if(!this.needGenerator || !this.spawner) {
            return
        }

        const actors = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_GENERIC)

        if(actors.length < maxActors) {
            this.spawner.enqueue(new GenericCreepTemplate(this))
        }

        this.needGenerator.assignTasks(actors)
    }

    private manageReservers(maximum: number) {
        if(!this.roomAnalyst || !this.needGenerator || !this.spawner) {
            return
        }

        const creeps = this.filterCreeps(CREEP_ROLE_RESERVE, true)

        if(creeps.length < maximum) {
            this.spawner.enqueue(new ReserveCreepTemplate(this.name));
        }

        this.needGenerator.assignTasks(creeps, true)
    }

    filterCreeps(role: CreepRole, remote: boolean) {
        let result = this.creeps.filter(creep => creep.memory.role === role)

        if(remote) {
            result = result.filter(creep => creep.memory.remote)
        }
        else {
            result = result.filter(creep => !creep.memory.remote)
        }

        return result
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

    getNeedGenerator() {
        return this.needGenerator
    }

    getRemoteRoom(roomName: string) {
        return this.remoteRooms.find(room => room.name === roomName)
    }

    getRemoteRooms() {
        return this.remoteRooms
    }

    getThreatManager() {
        return this.roomThreatManager
    }

    getRoomStats() {
        return this.roomStats
    }

    get name() {
        return this.memory.roomName
    }

    get label() {
        return this.memory.roomLabel
    }

    get namingGroup() {
        return this.memory.namingGroup
    }

    doVisualize() {
        for(const spawnUsage of (this.roomStats?.getAverageSpawnUsage() || [])) {
            if(!spawnUsage.spawn) {
                continue
            }

            this.room.visual.text(`${spawnUsage.usage}% (${spawnUsage.ticksUsed})`, spawnUsage.spawn?.pos, {
                stroke: 'black',
                color: 'white',
            })
        }

        const energyValues:number[] = []
        const statLines = []
        for(const room of this.remoteRooms) {
            const stats = room.getRoomStats()
            const analyst = room.getRoomAnalyst()
            if(stats && analyst) {
                statLines.push(`[${room.label}] Avg energy to pickup: ${stats.getAverageEnergyToPickup()}`)
                energyValues.push(stats.getAverageEnergyToPickup() / analyst.getMiningSites().length)
            }
        }
        const sum = energyValues.reduce((a, b) => a + b, 0)
        statLines.unshift(
            `${this.label} Avg energy to pickup: ${this.roomStats?.getAverageEnergyToPickup()}`,
            `Remote rooms (avg: ${sum/energyValues.length}) :: ${sum} / ${energyValues.length} :: ${energyValues}`
        )

        statLines.forEach((line, index) => {
            this.room.visual.text(line, 49, 0 + index, {
                align: 'right',
                stroke: 'black',
                color: 'white'
            })
        })
    }

    toString() {
        return `[RoomManager ${this.memory.roomLabel}]`
    }
}
