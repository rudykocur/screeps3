import { CreepCreatedEvent, SpawnerChannel, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { CREEP_ROLE_DEFENDER } from "../constants";
import { IOwnedRoomManager, IRemoteRoom, RoomBus } from "interfaces";
import { Logger } from "Logger";
import { RemoteRoomNeedGenerator } from "needs/NeedGenerator";
import { DefenderCreepTemplate, ScoutCreepTemplate } from "spawner/CreepSpawnTemplate";
import { RunResultType } from "./AbstractTask";
import { ReserveRoom } from "./creeps/ReserveRoom";
import { PersistentTask } from "./PersistentTask";
import { RoomAnalyst } from "./RoomAnalyst";
import { HuntEnemies } from "./combat/HuntEnemies";
import { SpawnPriority } from "Spawner";
import { EventBusMaster, createEventBus } from "bus/EventBus";
import { ROOM_EVENTS_BUS_NAME, RoomEvents } from "bus/RoomActionsEvents";
import { RemoteRoomStats } from "./RoomStats";
import { ThreatEvents, THREAT_EVENTS_BUS_NAME } from "bus/ThreatEvents";
import { RoomThreatManager } from "./RoomThreatManager";
import { nameSelector } from "utils/RoomNaming";

interface RemoteRoomManagerMemory {
    roomName: string
    roomLabel: string
    parentRoomName: string
    scout?: ScoutMemoryData
}

interface RemoteRoomManagerArgs {
    roomName: string
    parentRoom: IOwnedRoomManager
}

interface ScoutMemoryData {
    spawnId?: string | null
    actorName?: string | null
}

@PersistentTask.register
export class RemoteRoomManager extends PersistentTask<RemoteRoomManagerMemory, RemoteRoomManagerArgs> implements IRemoteRoom {

    private room?: Room | null
    private parentRoom?: IOwnedRoomManager

    private analyst: RoomAnalyst | null
    private stats: RemoteRoomStats | null
    private threatManager: RoomThreatManager | null
    private needGenerator: RemoteRoomNeedGenerator | null

    private scout?: Creep | null
    private creeps: Creep[]

    private spawnId?: string | null

    private bus: RoomBus

    private logger = new Logger('RemoteRoomManager')

    private selectName(parentRoomName: string) {
        const parent = Game.manager.getOwnedRoomManager(parentRoomName)
        if(parent) {
            const rooms = parent.getRemoteRooms().map(room => room.label)
            return nameSelector.selectLocation(parent.namingGroup, rooms)
        }

        return null
    }

    initMemory(args: RemoteRoomManagerArgs): RemoteRoomManagerMemory {
        return {
            roomName: args.roomName,
            parentRoomName: args.parentRoom.name,
            roomLabel: this.selectName(args.parentRoom.name) || ""
        }
    }

    doPreInit() {
        Game.manager.registerRoomManager(this)

        this.analyst = this.findTask(RoomAnalyst)
        this.stats = this.findTask(RemoteRoomStats)
        this.threatManager = this.findTask(RoomThreatManager)
        this.needGenerator = this.findTask(RemoteRoomNeedGenerator)

        this.bus = new EventBusMaster({
            [ROOM_EVENTS_BUS_NAME]: createEventBus<RoomEvents>(),
            [THREAT_EVENTS_BUS_NAME]: createEventBus<ThreatEvents>(),
        })
    }

    doInit(): void {
        this.parentRoom = Game.manager.getOwnedRoomManager(this.memory.parentRoomName)
        this.room = Game.rooms[this.memory.roomName]

        this.scout = this.memory.scout?.actorName ? Game.creeps[this.memory.scout?.actorName] : null

        if(!this.scout && this.memory.scout) {
            this.logger.info(this, 'scout died ...')
            this.memory.scout = undefined
        }

        this.creeps = Object.values(Game.creeps).filter(creep => creep.memory.room === this.memory.roomName)

        if(this.analyst) {
            this.stats?.setAnalyst(this.analyst)
        }
    }

    doRun(): RunResultType {
        if(!this.parentRoom) {
            return
        }

        this.parentRoom.getEventBus().getBus(SPAWNER_BUS_NAME).subscribe(SpawnerChannel.CREEP_CREATED, this.handleCreepCreated.bind(this))

        if(!this.room) {
            const spawner = this.parentRoom.getSpawner()
            if(!this.memory.scout?.actorName && spawner) {
                this.spawnId = spawner.enqueue(new ScoutCreepTemplate(this.name), SpawnPriority.HIGH)
            }
        }
        else {
            if(!this.analyst) {
                this.analyst = this.scheduleBackgroundTask(RoomAnalyst, {
                    roomName: this.name
                })
            }
            if(!this.stats) {
                this.stats = this.scheduleBackgroundTask(RemoteRoomStats, {
                    room: this
                })
            }
            if(!this.threatManager) {
                this.threatManager = this.scheduleBackgroundTask(RoomThreatManager, {
                    room: this
                })
            }
            if(!this.needGenerator) {
                this.needGenerator = this.scheduleBackgroundTask(RemoteRoomNeedGenerator, {
                    room: this,
                    parentRoom: this.parentRoom
                })
            }
        }

        if(this.scout) {
            const task = this.findTask(ReserveRoom)
            if(!task) {
                this.scheduleBackgroundTask(ReserveRoom, {
                    room: this,
                    actor: this.scout
                })
            }
        }

        this.doThreatHandling()
    }

    private doThreatHandling() {
        if(!this.parentRoom || !this.threatManager) {
            return
        }

        const status = this.threatManager.getThreatStatus()

        if(status.isActive()) {
            const defenders = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_DEFENDER)

            if(defenders.length <= 0) {
                this.parentRoom.getSpawner()?.enqueue(new DefenderCreepTemplate(this.parentRoom, this.memory.roomName), SpawnPriority.HIGH)
            }
            else {
                const task = this.findTask(HuntEnemies)

                if(!task) {
                    this.scheduleBackgroundTask(HuntEnemies, {
                        actor: defenders[0],
                        enemies: status.getHostileCreeps()
                    })
                }
            }
        }
    }

    handleCreepCreated(event: CreepCreatedEvent) {
        if(this.spawnId && event.spawnId === this.spawnId) {
            this.logger.important(this, 'Created scout')
            this.memory.scout = {
                actorName: event.creepName
            }
        }
    }

    getRoomAnalyst() {
        return this.analyst
    }

    getNeedGenerator() {
        return this.needGenerator
    }

    getDroppedResources() {
        return this.room?.find(FIND_DROPPED_RESOURCES, {
            filter: res => res.amount > 100
        }) || []
    }

    getNeedsReserver() {
        const threat = this.threatManager?.getThreatStatus()
        if(threat && threat.isActive()) {
            return false
        }

        const reservation = this.room?.controller?.reservation
        if(reservation === undefined) {
            return true
        }

        return reservation.ticksToEnd < 4000
    }

    getController() {
        return this.room?.controller
    }
    getEventBus() {
        return this.bus
    }

    getThreatManager() {
        return this.threatManager
    }

    getRoomStats() {
        return this.stats
    }

    get name() {
        return this.memory.roomName
    }

    get label() {
        return this.memory.roomLabel
    }

    get parentRoomName() {
        return this.parentRoom?.name
    }

    toString() {
        return `[RemoteRoomManager ${this.memory.roomLabel} parent=${this.parentRoom?.label || this.memory.parentRoomName}]`
    }
}
