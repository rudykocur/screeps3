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

interface RemoteRoomManagerMemory {
    roomName: string
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
    private enemies: Creep[] = []

    private spawnId?: string | null

    private bus: RoomBus

    private logger = new Logger('RemoteRoomManager')

    initMemory(args: RemoteRoomManagerArgs): RemoteRoomManagerMemory {
        return {
            roomName: args.roomName,
            parentRoomName: args.parentRoom.name
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
        if(this.room) {
            this.enemies = this.room.find(FIND_HOSTILE_CREEPS, {
                filter: creep => {
                    return creep.getActiveBodyparts(ATTACK) > 0
                        || creep.getActiveBodyparts(RANGED_ATTACK) > 0
                        || creep.getActiveBodyparts(HEAL) > 0
                }
            })
        }

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

        if(this.enemies.length > 0) {
            const defenders = this.creeps.filter(creep => creep.memory.role === CREEP_ROLE_DEFENDER)

            if(defenders.length <= 0) {
                this.parentRoom.getSpawner()?.enqueue(new DefenderCreepTemplate(this.parentRoom, this.memory.roomName), SpawnPriority.HIGH)
            }
            else {
                const task = this.findTask(HuntEnemies)

                if(!task) {
                    this.scheduleBackgroundTask(HuntEnemies, {
                        actor: defenders[0],
                        enemies: this.enemies
                    })
                }
            }
        }
    }

    handleCreepCreated(event: CreepCreatedEvent) {
        if(this.spawnId && event.spawnId === this.spawnId) {
            this.logger.important('Created scout for room ' + this.name)
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
        const reservation = this.room?.controller?.reservation
        if(reservation === undefined) {
            return true
        }

        return reservation.ticksToEnd < 4000
    }

    getEventBus() {
        return this.bus
    }

    getThreatManager() {
        return this.threatManager
    }

    get name() {
        return this.memory.roomName
    }

    get parentRoomName() {
        return this.parentRoom?.name
    }

    toString() {
        return `[RemoteRoomManager ${this.memory.roomName} parent=${this.memory.parentRoomName}]`
    }
}
